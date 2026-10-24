import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, createDashboardSession, passwordMatches } from "@/lib/dashboard-auth";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const password =
    body !== null && typeof body === "object" && "password" in body && typeof body.password === "string"
      ? body.password
      : "";

  if (!passwordMatches(password)) {
    // Slow repeated guesses without storing state in a serverless function.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const session = await createDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Dashboard authentication is not configured" }, { status: 503 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: session.maxAge,
  });
  return response;
}
