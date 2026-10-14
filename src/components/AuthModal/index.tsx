"use client";
import React, { useContext, useState } from "react";
import { Context } from "@/context";
import { apiRequest } from "../utils/api";
import { formatMoney } from "../utils/money";
import { useLimits } from "../utils/useLimits";
import "./auth.scss";

interface AuthModalProps {
  onClose?: () => void;
}

type Tab = "login" | "register";

export default function AuthModal({ onClose }: AuthModalProps) {
  const { login } = useContext(Context);
  const limits = useLimits();
  const [tab, setTab] = useState<Tab>("login");

  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const switchTab = (t: Tab) => { setTab(t); setError(""); };

  const validate = (): string => {
    if (tab === "login") {
      return !identifier.trim() || !password ? "Enter your username or email and your password." : "";
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username.trim())) return "Username must be 3-20 characters: letters, numbers or underscores.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password needs 8+ characters with at least one letter and one number.";
    if (password !== confirm) return "The two passwords don't match.";
    if (!agree) return "Confirm that you are 18 or older to create an account.";
    return "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) return setError(problem);
    setError("");
    setBusy(true);
    try {
      if (tab === "register") {
        await apiRequest("/auth/register", {
          auth: false,
          body: { username: username.trim(), email: email.trim(), password, acceptTerms: true },
        });
        await login(username.trim(), password); // the server returns no token on sign-up, so sign in right after
      } else {
        await login(identifier.trim(), password);
      }
      onClose?.();
    } catch (err: any) {
      setError(err?.message || (tab === "login" ? "Sign in failed. Check your details and try again." : "Sign up failed. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-overlay">
      {/* the multiplier curve draws itself once behind the form */}
      <svg className="auth-curve" viewBox="0 0 1200 700" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 700 C 300 690, 600 640, 820 470 S 1100 120, 1200 40" fill="none" stroke="#f39c12" strokeOpacity="0.5" strokeWidth="3" pathLength={1} strokeDasharray="1" strokeDashoffset="1">
          <animate attributeName="stroke-dashoffset" from="1" to="0" dur="2.4s" fill="freeze" />
        </path>
      </svg>

      <div className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <h2 id="auth-title" className="auth-title">{tab === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="auth-sub">
          {tab === "login"
            ? "Sign in to place your bets."
            : `Deposits start at ${formatMoney(limits.MIN_DEPOSIT)}. Withdrawals start at ${formatMoney(limits.MIN_WITHDRAWAL)}.`}
        </p>

        <div className="auth-tabs" role="tablist">
          {(["login", "register"] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`auth-tab ${tab === t ? "is-active" : ""}`} onClick={() => switchTab(t)}>
              {t === "login" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} noValidate className="auth-form">
          {tab === "login" ? (
            <div className="auth-field">
              <label htmlFor="auth-id">Username or email</label>
              <input id="auth-id" className="auth-input" autoComplete="username" autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </div>
          ) : (
            <>
              <div className="auth-field">
                <label htmlFor="auth-user">Username</label>
                <input id="auth-user" className="auth-input" autoComplete="username" maxLength={20} autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="auth-field">
                <label htmlFor="auth-email">Email</label>
                <input id="auth-email" className="auth-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </>
          )}

          <div className="auth-field">
            <label htmlFor="auth-pw">Password</label>
            <div className="auth-pw">
              <input id="auth-pw" className="auth-input" type={show ? "text" : "password"} autoComplete={tab === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="auth-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {tab === "register" && (
            <>
              <div className="auth-field">
                <label htmlFor="auth-pw2">Confirm password</label>
                <input id="auth-pw2" className="auth-input" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <label className="auth-check">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I am 18 or older and accept the terms. I understand I can lose the money I bet.</span>
              </label>
            </>
          )}

          {error && <div role="alert" className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? (tab === "login" ? "Signing in…" : "Creating account…") : tab === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="auth-foot">18+ only. Play responsibly.</p>
      </div>
    </div>
  );
}
