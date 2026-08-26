import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth/options";

// NextAuth web handler (OAuth + Credentials sign-in, session, CSRF, callbacks).
// Mobile clients use the dedicated /api/v1/auth/* endpoints instead.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
