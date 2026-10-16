import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { userService } from "@/services/user.service";

export async function GET(request: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";

    const users = await userService.searchUsers(query);

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("[USERS_SEARCH_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
