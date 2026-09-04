# Production deployment

Homyz runs as a **Next.js 16** container behind an **AWS Application Load Balancer**.
The database is **Neon PostgreSQL** today (`DATABASE_URL`). **Amazon RDS** is a later
swap of that same URL — do not run Postgres on EC2. **User media** belongs in **S3**.

```text
Internet
   │ HTTPS (ACM)
   ▼
AWS Application Load Balancer
   │ HTTP to instance:3000 (TLS terminated at ALB)
   ▼
EC2 (security group: 3000 from ALB only)
   │ Docker
   ▼
Next.js container  (0.0.0.0:3000)
   │
   ├── DATABASE_URL  →  Neon (future: RDS)
   ├── S3_BUCKET     →  listing photos, stamp icons, host documents
   └── REDIS_URL     →  optional
```

CI/CD:

```text
git push main
  → GitHub Actions validate (scan, install, lint, typecheck, build)
  → Docker build (immutable tag = git SHA)
  → Amazon ECR
  → EC2: pull → start candidate → /api/health → switch port 3000 → stop old
```

The existing PM2/VPS job stays active until GitHub Actions variable
`ENABLE_DOCKER_DEPLOY` is set to `true`.

---

## Local Docker

From the repo root (needs a `.env` with real local/dev values, never commit it):

```bash
docker build -t homyz:local .
docker run --rm --env-file .env -p 3000:3000 homyz:local
```

Or:

```bash
export HOMYZ_IMAGE=homyz:local
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f app
curl -fsS http://127.0.0.1:3000/api/health
```

Optional Redis:

```bash
docker compose --profile redis -f docker-compose.prod.yml up -d
# set REDIS_URL=redis://redis:6379 in .env when using the compose network
```

Production start command inside the image is `node server.js` (standalone),
**not** `next dev`.

---

## AWS prerequisites

Create these in your account (values stay in AWS / GitHub, not in git):

1. **ECR** repository (suggested name `homyz`).
2. **EC2** Amazon Linux 2023 (or Ubuntu) in a private or public subnet that can
   reach Neon, S3, and ECR. Attach an instance role (below).
3. **ALB** in public subnets, HTTPS listener, HTTP→HTTPS redirect.
4. **ACM** certificate for the public hostname.
5. **S3** bucket for media (Block Public Access on; CloudFront or bucket policy
   for `listing-photos/*` and `stamp-icons/*` only).
6. **Neon** project (or later **RDS PostgreSQL**). Same `DATABASE_URL` shape.
7. GitHub OIDC identity provider + IAM role for Actions (preferred over long-lived keys).

Do not put AWS account IDs, ECR URLs, IPs, or secrets in application code.

### IAM

**GitHub Actions deploy role** (OIDC): `ecr:GetAuthorizationToken`,
`ecr:BatchCheckLayerAvailability`, `ecr:CompleteLayerUpload`, `ecr:InitiateLayerUpload`,
`ecr:PutImage`, `ecr:UploadLayerPart`, `ecr:BatchGetImage`.

**EC2 instance role:**

- ECR pull (`ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`)
- S3 `s3:GetObject`, `s3:PutObject` on the media bucket (and `s3:DeleteObject` if you add deletes later)
- CloudWatch agent optional (`logs:*` / `cloudwatch:PutMetricData` as needed)

Prefer the instance role over `AWS_ACCESS_KEY_ID` in `.env`.

### Security groups

| Source | Dest | Port | Why |
| --- | --- | --- | --- |
| `0.0.0.0/0` | ALB | 443 | HTTPS |
| `0.0.0.0/0` | ALB | 80 | redirect to HTTPS |
| ALB SG | EC2 SG | 3000 | target group |
| EC2 | Neon / RDS | 5432 | **not** public; Neon allowlists the NAT/EIP |
| EC2 | S3 / ECR / APIs | 443 | AWS + Resend/Twilio/OAuth |

Do **not** expose 3000, 5432, or 6379 to the internet.

### Load balancer / target group

- Target: instance port **3000**, protocol HTTP
- Health check: **HTTP `/api/health`**, matcher `200`, interval ~15s, healthy threshold 2
- Idle timeout: 60s (raise if you have long uploads)
- Stickiness: **off** (JWT sessions)
- Attributes: HTTP/2 on; do not buffer if you rely on streaming
- HTTPS listener uses the ACM cert; HTTP listener redirects to HTTPS

`/api/health` is liveness only. `/api/ready` and `/api/v1/health` check Postgres
(and Redis if configured) — use those for ops, not for high-frequency ALB probes.

---

## EC2 host setup

```bash
# Amazon Linux 2023
sudo dnf update -y
sudo dnf install -y docker git curl
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

# Docker Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

sudo mkdir -p /opt/homyz/scripts/deploy
# Copy docker-compose.prod.yml and scripts/deploy/*.sh from this repo into /opt/homyz
sudo nano /opt/homyz/.env   # runtime secrets only; chmod 600
```

ECR login (instance role):

```bash
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"
```

First start (or after copying compose):

```bash
export HOMYZ_IMAGE="$ECR_REGISTRY/homyz:<git-sha>"
cd /opt/homyz
bash scripts/deploy/release.sh
```

Logs:

```bash
docker logs -f homyz-app
docker inspect --format '{{.Config.Image}}' homyz-app
```

Health:

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3000/api/ready
```

Rollback:

```bash
# uses /opt/homyz/.image-previous written by the last successful switch
bash /opt/homyz/scripts/deploy/rollback.sh
```

---

## Environment variables

Copy `.env.example` → `.env`. Required in production:

- `DATABASE_URL` — Neon (or later RDS) with TLS
- `NEXTAUTH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `APP_URL` / `NEXTAUTH_URL` — public `https://` hostname
- `S3_BUCKET` (+ `S3_REGION` / `AWS_REGION`)
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` if more than one EC2

The Docker **image must not** contain these values. Pass them with `--env-file` /
Compose `env_file`.

At **image build**, pass the public hostname so Server Actions allow the ALB origin:

```bash
docker build \
  --build-arg APP_URL=https://your.domain \
  --build-arg NEXTAUTH_URL=https://your.domain \
  -t homyz:<sha> .
```

---

## Database migrations

Prisma: `npm run db:migrate:deploy` (`prisma migrate deploy`).

- **Do not** run `prisma migrate dev` or `prisma migrate reset` in production.
- **Do not** auto-migrate on every container start.
- Run migrate **once**, deliberately, from CI (when `RUN_DB_MIGRATE=true`) or a
  one-off job **before** switching traffic if the migration is backward-compatible
  with the currently running app version.

Neon today / RDS later: only `DATABASE_URL` changes. Enable SSL (`sslmode=require`).
Do not expose the database on the EC2 public interface.

---

## S3 media

When `S3_BUCKET` is set:

| Prefix | Visibility | Used for |
| --- | --- | --- |
| `listing-photos/` | public URL (or CloudFront) | listing images |
| `stamp-icons/` | public URL | stamp icons |
| `host-documents/` | private | KYC docs; bytes returned only via authenticated API |

Without `S3_BUCKET`, files still write to `public/uploads/` (fine for local dev,
ephemeral on Docker/EC2).

Suggested bucket policy: deny public `host-documents/*`; allow read on the two
public prefixes (or put CloudFront in front and keep the bucket private).

---

## GitHub Actions / secrets

Repository **variables**:

- `AWS_REGION`
- `ECR_REPOSITORY` (e.g. `homyz`)
- `APP_URL` (public https origin, used as Docker build-arg)
- `ENABLE_DOCKER_DEPLOY` = `true` to cut over from PM2 to ECR/EC2
- `RUN_DB_MIGRATE` = `true` only when you intend to apply Prisma migrations

Repository **secrets**:

- `AWS_ROLE_TO_ASSUME` — OIDC role ARN
- `EC2_SSH_HOST`, `EC2_SSH_USER`, `EC2_SSH_KEY` — or replace later with SSM
- `DATABASE_URL` — only if `RUN_DB_MIGRATE=true`

Do not store `AWS_ACCESS_KEY` / `AWS_SECRET` in git. Prefer OIDC.

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| ALB target unhealthy | SG 3000 from ALB; `curl /api/health` on the instance; container `docker logs` |
| 502 after deploy | Candidate failed health — old container should still be running |
| Server Actions fail | Rebuild image with `APP_URL` matching the browser origin |
| Uploads disappear | `S3_BUCKET` not set |
| OAuth redirect mismatch | `NEXTAUTH_URL` / provider console must be the HTTPS ALB hostname |
| Neon timeout | allow the EC2 NAT IP on Neon; `sslmode=require` |
| Image pull denied | EC2 instance role ECR permissions; `aws ecr get-login-password` |

---

## Future: Amazon RDS

When you move off Neon:

1. Provision RDS PostgreSQL (private subnet, SG from EC2 only).
2. `prisma migrate deploy` against the new URL (or dump/restore).
3. Change `DATABASE_URL` on the EC2 `.env` (and GitHub migrate secret).
4. Recreate the app container. No Dockerfile change.
