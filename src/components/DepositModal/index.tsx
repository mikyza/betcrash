"use client";
import React, { useContext, useEffect, useRef, useState } from "react";
import { Context } from "@/context";
import toast from "react-hot-toast";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const QUICK_AMOUNTS = [10, 50, 100, 500, 1000, 2000];
const DEFAULT_minDeposit = 10;

type Phase = "form" | "waiting" | "done" | "failed";

export default function DepositModal({ onClose }: { onClose: () => void }) {
  const { userInfo } = useContext(Context);
  const [amount, setAmount] = useState("100");
  const [minDeposit, setMinDeposit] = useState(DEFAULT_minDeposit);
  const [phone, setPhone] = useState(String((userInfo as any)?.phone ?? "").replace(/^254/, "0"));
  const [phase, setPhase] = useState<Phase>("form");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (poll.current) clearInterval(poll.current); poll.current = null; };
  useEffect(() => stop, []);
  useEffect(() => { fetch(`${BACKEND_URL}/api/v1/games/config`).then((r) => r.json()).then((b) => b?.data?.minDeposit && setMinDeposit(b.data.minDeposit)).catch(() => undefined); }, []);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("aviator_token") || "" : "");
  const cur = userInfo?.currency || "KES";

  const watch = (paymentId: string) => {
    const started = Date.now();
    stop();
    poll.current = setInterval(async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/v1/payments/deposit/${paymentId}`, { headers: { Authorization: `Bearer ${token()}` } });
        const b = await r.json();
        const st = b?.data?.status;
        if (st === "paid") { stop(); setPhase("done"); toast.success(`${cur} ${Number(amount).toLocaleString()} added to your wallet`); }
        else if (st === "failed") { stop(); setPhase("failed"); setMessage(b?.data?.failureReason || "The payment was cancelled or failed."); }
        else if (Date.now() - started > 120_000) { stop(); setPhase("failed"); setMessage("We did not receive confirmation yet. If money left your M-Pesa it will be credited automatically within a few minutes."); }
      } catch { /* keep polling */ }
    }, 3000);
  };

  const submit = async () => {
    const n = Math.floor(Number(amount));
    if (!n || n < minDeposit) return toast.error(`Minimum deposit is ${cur} ${minDeposit}`);
    if (!/^(?:\+?254|0)?[17]\d{8}$/.test(phone.replace(/[\s-]/g, ""))) return toast.error("Enter a valid Safaricom number e.g. 0712345678");
    if (!token()) return toast.error("Please log in first");
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/payments/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ amount: n, phone }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.data?.message || body?.message || "Could not start deposit");
      setPhase("waiting");
      watch(body.data.paymentId);
    } catch (e: any) { toast.error(e?.message || "Could not start deposit"); }
    finally { setLoading(false); }
  };

  const box: React.CSSProperties = { background: "#12141f", border: "1px solid #2c3150", borderRadius: 8, color: "#fff", width: "100%", padding: "10px 12px", fontSize: 16, fontWeight: 600, outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }} onClick={(e) => e.target === e.currentTarget && phase !== "waiting" && onClose()}>
      <div style={{ background: "#1a1d2e", borderRadius: 12, width: "100%", maxWidth: 420, padding: 28, boxShadow: "0 8px 40px rgba(0,0,0,0.6)", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f39c12" }}>Deposit via M-Pesa</h3>
          <button onClick={() => { stop(); onClose(); }} style={{ background: "none", border: "none", color: "#9097a8", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {phase === "form" && (
          <>
            <div style={{ background: "#12141f", borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#9097a8", fontSize: 13 }}>Current balance</span>
              <span style={{ fontWeight: 700, color: "#f39c12" }}>{cur} {Number(userInfo.balance).toFixed(2)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
              {QUICK_AMOUNTS.map((a) => (
                <button key={a} onClick={() => setAmount(String(a))} style={{ padding: "10px 6px", background: amount === String(a) ? "#f39c12" : "#12141f", color: amount === String(a) ? "#000" : "#9097a8", border: `1px solid ${amount === String(a) ? "#f39c12" : "#2c3150"}`, borderRadius: 8, cursor: "pointer", fontWeight: amount === String(a) ? 700 : 400 }}>
                  {a.toLocaleString()}
                </button>
              ))}
            </div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#9097a8" }}>Amount ({cur}, min {minDeposit})</label>
            <input type="number" value={amount} min={minDeposit} onChange={(e) => setAmount(e.target.value)} style={{ ...box, marginBottom: 14 }} />
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#9097a8" }}>M-Pesa phone number</label>
            <input type="tel" inputMode="tel" value={phone} placeholder="0712 345 678" onChange={(e) => setPhone(e.target.value)} style={{ ...box, marginBottom: 20 }} />
            <button onClick={submit} disabled={loading} style={{ width: "100%", padding: 14, background: loading ? "#6b5a2a" : "#f39c12", color: loading ? "#aaa" : "#000", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Sending prompt..." : `Pay ${cur} ${Number(amount || 0).toLocaleString()}`}
            </button>
            <p style={{ textAlign: "center", color: "#9097a8", fontSize: 12, margin: "12px 0 0" }}>You will get an M-Pesa prompt on your phone. Enter your PIN to confirm. 18+ only. Play responsibly.</p>
          </>
        )}
        {phase === "waiting" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📲</div>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>Check your phone</p>
            <p style={{ color: "#9097a8", fontSize: 14 }}>Enter your M-Pesa PIN to pay {cur} {Number(amount).toLocaleString()}. We will update your balance as soon as the payment is confirmed.</p>
          </div>
        )}
        {phase === "done" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 700 }}>Deposit successful</p>
            <button onClick={onClose} style={{ marginTop: 16, padding: "10px 24px", background: "#f39c12", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Start playing</button>
          </div>
        )}
        {phase === "failed" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <p style={{ color: "#ddd", fontSize: 14 }}>{message}</p>
            <button onClick={() => setPhase("form")} style={{ marginTop: 16, padding: "10px 24px", background: "#f39c12", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
