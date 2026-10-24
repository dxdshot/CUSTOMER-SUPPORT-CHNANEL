import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  dashboardAuthConfigured,
  verifyDashboardSession,
} from "@/lib/dashboard-auth";

export async function proxy(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifyDashboardSession(session)) return NextResponse.next();

  // Without credentials, keep local development usable but never leave a
  // production dashboard open.
  if (!dashboardAuthConfigured() && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  if (dashboardAuthConfigured()) {
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  }
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
