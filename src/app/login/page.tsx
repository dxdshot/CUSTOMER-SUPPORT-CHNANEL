import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { SESSION_COOKIE, dashboardAuthConfigured, verifyDashboardSession } from "@/lib/dashboard-auth";

// The page reads the session cookie and the post-login destination, so it must
// stay dynamic instead of prerendering a shell.
export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: requested } = await searchParams;
  const next = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (await verifyDashboardSession(session)) redirect(next);

  const configured = dashboardAuthConfigured();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>

        {configured ? (
          <LoginForm next={next} />
        ) : (
          <div className="mt-8 rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
            Dashboard authentication is not configured. Set{" "}
            <code className="text-foreground">DASHBOARD_PASSWORD</code> and{" "}
            <code className="text-foreground">DASHBOARD_AUTH_SECRET</code> in the environment.
          </div>
        )}

        <Link
          href="/demo"
          className="mt-8 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Open the demo instead
        </Link>
      </div>
    </main>
  );
}
