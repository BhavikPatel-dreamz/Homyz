# Infrastructure (manual console — no account IDs in git)

Application runtime: [docs/deployment.md](../docs/deployment.md).

Do **not** commit account IDs, passwords, or private keys.

## Order

1. ECS + Docker (Next.js only)
2. **Load balancer** (HTTPS → `:3000`)
3. **RDS PostgreSQL** (replace Neon via `DATABASE_URL` only)

## Load balancer

Use the cloud LB in the **same VPC** as the ECS. Do not put Nginx in Docker as a substitute if you want a real balancer.

| | Alibaba (current ECS) | AWS |
| --- | --- | --- |
| Product | Application Load Balancer (ALB) or CLB | Application Load Balancer |
| Backend | ECS private IP, **port 3000**, HTTP | EC2, **port 3000**, HTTP |
| Health | `GET /api/health` | same |
| TLS | Alibaba SSL certificate on :443 | ACM on :443 |
| SG | Internet → LB 80/443; LB → ECS 3000 | same |

Stickiness off. After it is healthy, remove public **3000**.

Then set `APP_URL` / `NEXTAUTH_URL` to `https://your.domain` and **rebuild** the image.

## Database (Phase 3 only)

Keep using Neon until the LB serves HTTPS.

Then create managed Postgres in the **same VPC**, private, SSL, SG from the app host to **5432** only:

- Alibaba **ApsaraDB RDS for PostgreSQL**
- or Amazon **RDS PostgreSQL**

App change: one line in `/opt/homyz/.env`, then recreate the container. See Phase 3 in `docs/deployment.md`.

## Out of scope here

- VPC / vSwitch (use the ECS VPC)
- S3 / OSS buckets
- Terraform/CloudFormation (add later; still no secrets in git)
