"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError(
          response.status === 503
            ? "Dashboard authentication is not configured."
            : "That password is not right.",
        );
        setBusy(false);
        return;
      }
      router.replace(next);
    } catch {
      setError("Could not reach the server. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
      <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoFocus
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-[#676767]"
      />
      {error && (
        <p role="alert" className="text-xs text-[#f87171]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !password}
        className="h-10 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
