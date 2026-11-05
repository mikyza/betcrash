"use client";
import React from "react";
import Link from "next/link";
import { ApiError, apiRequest, getToken } from "../utils/api";

type State = "checking" | "admin" | "denied" | "error";

/** Asks the server who this token belongs to. Only a UX gate: every /admin API route also enforces the admin role. */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>("checking");

  React.useEffect(() => {
    if (!getToken()) { setState("denied"); return; }
    apiRequest<{ role: string }>("/users/me")
      .then((u) => setState(u.role === "admin" ? "admin" : "denied"))
      .catch((e) => setState(e instanceof ApiError && (e.status === 401 || e.status === 403) ? "denied" : "error"));
  }, []);

  if (state === "admin") return <>{children}</>;
  if (state === "checking") return <p className="p-6 text-sm text-white/40">Checking access…</p>;
  return (
    <div className="mx-auto mt-24 max-w-sm space-y-3 text-center text-white">
      <h1 className="text-lg font-semibold">{state === "error" ? "Can't reach the server" : "Admins only"}</h1>
      <p className="text-sm text-white/50">
        {state === "error" ? "Check your connection and reload the page." : "Sign in with an admin account to open this panel."}
      </p>
      <Link href="/" className="inline-block text-sm font-medium text-orange-400 hover:underline">Back to the game</Link>
    </div>
  );
}
