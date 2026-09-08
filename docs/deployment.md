# Production deployment

Do this in **order**. Do not move the database until the load balancer is healthy.

```text
Phase 1  Docker on the ECS (Next.js only)
Phase 2  Load balancer (HTTPS in front of :3000)
Phase 3  Managed PostgreSQL RDS  ← only after Phase 2
```

```text
Internet
   │ HTTPS :443
   ▼
Load balancer  (Alibaba ALB / later AWS ALB)
   │ HTTP → private IP:3000
   │ health: GET /api/health
   ▼
ECS Docker  →  Next.js only (0.0.0.0:3000)
   ├── DATABASE_URL  →  Neon now  →  RDS in Phase 3
   ├── REDIS_URL     →  external (optional)
   ├── S3 / OSS      →  external
   └── Resend / Twilio / OAuth
```

Postgres, Redis, and object storage are **never** in the Docker image.

---

## Phase 1 — Docker on the Ubuntu ECS

Install Docker, put the app in `/opt/homyz`, create `/opt/homyz/.env` (`chmod 600`).

Build (on a machine with enough RAM) and run:

```bash
docker build --network=host --progress=plain \
  --build-arg APP_URL=https://YOUR_DOMAIN \
  --build-arg NEXTAUTH_URL=https://YOUR_DOMAIN \
  -t homyz:local .

# On the server, with /opt/homyz/.env already filled:
cd /opt/homyz
export HOMYZ_IMAGE=homyz:local
docker compose -f docker-compose.prod.yml up -d
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3000/api/ready
```

Until the load balancer exists, you may test on `http://PUBLIC_IP:3000`. After Phase 2, close **3000** to the internet.

Required in `.env` now:

- `DATABASE_URL` — Neon (TLS)
- `NEXTAUTH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `APP_URL` / `NEXTAUTH_URL` — the **public** URL users will type (the LB hostname once Phase 2 is done)

Rebuild the image whenever `APP_URL` changes (Server Action origins are baked at build time).

---

## Phase 2 — Load balancer (do this before RDS)

Goal: users hit `https://your.domain`, never `:3000`. The ECS security group should allow **3000 only from the load balancer**, not `0.0.0.0/0`.

The app is already LB-ready:

| Setting | Value |
| --- | --- |
| Target | instance **port 3000**, HTTP |
| Liveness | `GET /api/health` → `{ "status": "ok" }` (no database) |
| Readiness | `GET /api/ready` (Postgres; do **not** use this on the LB) |
| Stickiness | **off** (JWT / NextAuth cookies) |
| HTTP :80 | redirect to HTTPS |
| HTTPS :443 | certificate on the LB |

### Alibaba Cloud (this ECS)

Your MOTD is Alibaba ECS. Use **Application Load Balancer** (ALB) in the same VPC as the instance (`172.17.146.215` is the private NIC the LB will target).

1. **Domain** — point an A/CNAME record at the ALB address (or EIP). You need a domain for HTTPS.
2. **Certificate** — Alibaba SSL Certificates, then attach it to the ALB HTTPS listener.
3. **ALB** — same region and VPC as the ECS. Internet-facing.
4. **Server group**
   - Type: instance
   - Backend: this ECS, **port 3000**, protocol HTTP
   - Health check: HTTP, path `/api/health`, port 3000, success = 200
5. **Listeners**
   - `80` HTTP → redirect to HTTPS
   - `443` HTTPS → the server group
6. **Security groups**
   - Internet → ALB **80/443**
   - ALB → ECS **3000** only
   - SSH **22** only from your IP
   - Do **not** open 3000, 5432, or 6379 to `0.0.0.0/0`
7. **App URL** — set `APP_URL` and `NEXTAUTH_URL` to `https://your.domain`, rebuild the image, recreate the container.
8. Confirm:
   ```bash
   curl -fsS https://your.domain/api/health
   curl -fsS https://your.domain/api/ready
   ```
   Then remove the public **3000** rule.

Classic SLB (CLB) also works: HTTP/HTTPS listener → ECS `:3000`, same health path.

### AWS (if you move the VM later)

Same wiring: ALB → target group instance:3000, health `GET /api/health`, ACM on 443, SG internet→ALB 80/443, ALB→EC2 3000.

---

## Phase 3 — Move the database to RDS (after the LB is green)

The application does **not** care whether Postgres is Neon or RDS. Only `DATABASE_URL` changes. Do this **after** HTTPS through the load balancer works, so you are not changing how users reach the site and the database at the same time.

Alibaba: **ApsaraDB RDS for PostgreSQL** in the **same VPC**, private endpoint.  
AWS later: **Amazon RDS PostgreSQL** in a private subnet. Same steps.

### Create RDS

1. PostgreSQL 16 (or the major version Neon is on).
2. Same VPC as the ECS. **No public** endpoint.
3. Security group: ECS (or the app SG) → RDS **5432** only.
4. SSL required.
5. Create database `homyz` and a user. Save the URL:
   ```text
   postgresql://USER:PASSWORD@HOST:5432/homyz?sslmode=require
   ```

### Cut over

On a laptop that can reach **both** Neon and RDS (or from the ECS if Neon is allowed):

```bash
# 1. Freeze writes if you already have production data (maintenance window).

# 2. Empty RDS: apply Prisma migrations (no prisma migrate dev / reset).
DATABASE_URL='postgresql://USER:PASSWORD@RDS_HOST:5432/homyz?sslmode=require' \
  npx prisma migrate deploy

# 3. Copy data from Neon → RDS (example).
pg_dump "$OLD_NEON_URL" --no-owner --no-acl -Fc -f homyz.dump
pg_restore --no-owner --no-acl -d "$NEW_RDS_URL" homyz.dump

# 4. On the ECS, point the app at RDS and recreate the container.
#    Edit /opt/homyz/.env  DATABASE_URL=<rds url>
cd /opt/homyz
docker compose -f docker-compose.prod.yml up -d --force-recreate
curl -fsS http://127.0.0.1:3000/api/ready
```

If `/api/ready` shows `"database":"healthy"` through the load balancer, Neon can be retired.

Rollback: put the Neon URL back in `.env`, `docker compose ... up -d --force-recreate`.

Do not run `prisma migrate dev`, `db:seed`, or `reset` against production RDS.

---

## GitHub CI (optional later)

PM2/VPS deploy stays until `ENABLE_DOCKER_DEPLOY=true`. Docker→ECR is AWS-specific.

**Variables:** `AWS_REGION`, `ECR_REGISTRY`, `ECR_REPOSITORY`, `APP_URL`, `ENABLE_DOCKER_DEPLOY`, `RUN_DB_MIGRATE`  
**Secrets:** `AWS_ROLE_TO_ASSUME`, `EC2_SSH_*`, `DATABASE_URL` (migrate job only)

---

## Environment

Copy `.env.example` → `/opt/homyz/.env`. Production:

- `DATABASE_URL` — Neon now; RDS in Phase 3 (`sslmode=require`)
- `NEXTAUTH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `APP_URL` / `NEXTAUTH_URL` — public `https://` hostname on the **load balancer**
- `S3_BUCKET` (or equivalent) for durable uploads; without it, files die when the container is recreated
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` if you add a second ECS behind the same LB

Never commit `.env`.

---

## Commands

```bash
docker logs -f homyz-app
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3000/api/ready
HOMYZ_IMAGE="<previous-sha-image>" bash /opt/homyz/scripts/deploy/rollback.sh
```
