// Pagination helpers shared by API list endpoints. Query params are clamped so
// clients can never request an unbounded page.

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  /** Prisma `skip` */
  skip: number;
  /** Prisma `take` */
  take: number;
}

export function parsePagination(
  searchParams: URLSearchParams,
  opts?: { defaultLimit?: number; maxLimit?: number },
): PaginationParams {
  const defaultLimit = opts?.defaultLimit ?? 20;
  const maxLimit = opts?.maxLimit ?? 100;

  const rawPage = Number(searchParams.get("page") ?? 1);
  const rawLimit = Number(searchParams.get("limit") ?? defaultLimit);

  const page = Number.isFinite(rawPage) ? Math.max(1, Math.trunc(rawPage)) : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.trunc(rawLimit)), maxLimit)
    : defaultLimit;

  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function buildPagination(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
