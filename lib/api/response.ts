import { NextResponse } from "next/server";

import type { ErrorCode, ErrorDetail } from "./errors";
import type { PaginationMeta } from "./pagination";

// Consistent JSON envelope for every API response (web + mobile):
//   success: { success: true, data, pagination? }
//   error:   { success: false, error: { code, message, details? } }

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T): NextResponse {
  return ok(data, 201);
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function paginated<T>(
  data: T[],
  pagination: PaginationMeta,
  status = 200,
): NextResponse {
  return NextResponse.json({ success: true, data, pagination }, { status });
}

export function fail(
  error: { code: ErrorCode; message: string; details?: ErrorDetail[] },
  status: number,
): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}
