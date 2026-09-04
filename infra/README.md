# Future infrastructure as code

Application deploy is documented in [docs/deployment.md](../docs/deployment.md).

This folder is a placeholder for Terraform or CloudFormation when you want the
AWS resources versioned:

- VPC, public/private subnets
- Application Load Balancer + ACM
- EC2 (or ASG) + instance role
- ECR
- S3 media bucket + CloudFront
- Security groups (internet → 80/443 on ALB only)
- Later: **Amazon RDS PostgreSQL** (replacing Neon via `DATABASE_URL` only)

Do not commit account IDs, passwords, or private keys here.
