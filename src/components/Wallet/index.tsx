"use client";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Context } from "@/context";
import { apiRequest } from "../utils/api";
import { formatMoney } from "../utils/money";
import { useLimits } from "../utils/useLimits";
import "./wallet.scss";

export type WalletTab = "deposit" | "withdraw" | "history";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const QUICK_AMOUNTS = [10, 50, 100, 500, 1000, 5000];
const METHODS = ["UPI", "Bank"] as const;
type Method = (typeof METHODS)[number];
const AMOUNT_PATTERN = /^\d*\.?\d{0,2}$/;

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface Txn { id: string; type: string; amount: number; balanceAfter: number; currency: string; createdAt: string }
interface WithdrawalRow { id: string; amount: number; currency: string; method: string; status: "pending" | "approved" | "rejected"; adminNote: string; createdAt: string }

const TYPE_LABEL: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal requested",
  withdrawal_refund: "Withdrawal refunded",
  adjustment: "Adjustment",
};

const STATUS_LABEL: Record<WithdrawalRow["status"], string> = {
  pending: "Waiting for approval",
  approved: "Approved",
  rejected: "Rejected, refunded",
};

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/* ------------------------------------------------------------------ */

export default function WalletModal({ initialTab = "deposit", onClose }: { initialTab?: WalletTab; onClose: () => void }) {
  const { userInfo, updateUserInfo } = useContext(Context);
  const limits = useLimits();
  const currency = userInfo?.currency || "INR";
  const [tab, setTab] = useState<WalletTab>(initialTab);

  // handlers fire long after render (Razorpay callback), so read the latest user from a ref
  const userRef = useRef(userInfo);
  userRef.current = userInfo;
  const setBalance = useCallback(
    (balance: number) => updateUserInfo({ ...userRef.current, balance }),
    [updateUserInfo]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tabs: { id: WalletTab; label: string }[] = [
    { id: "deposit", label: "Deposit" },
    { id: "withdraw", label: "Withdraw" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="wlt-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wlt-modal" role="dialog" aria-modal="true" aria-label="Wallet">
        <div className="wlt-top">
          <div role="tablist" className="wlt-tabs">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={`wlt-tab ${tab === t.id ? "is-active" : ""}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <button className="wlt-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="wlt-balance">
          <span>Balance</span>
          <strong>{formatMoney(Number(userInfo?.balance) || 0, currency)}</strong>
        </div>

        {tab === "deposit" && <DepositPanel limits={limits} currency={currency} username={userInfo?.userName} setBalance={setBalance} onDone={onClose} />}
        {tab === "withdraw" && <WithdrawPanel limits={limits} currency={currency} balance={Number(userInfo?.balance) || 0} setBalance={setBalance} />}
        {tab === "history" && <HistoryPanel currency={currency} />}
      </div>
    </div>
  );
}

/* ------------------------------ deposit ------------------------------ */

function DepositPanel({ limits, currency, username, setBalance, onDone }: {
  limits: ReturnType<typeof useLimits>; currency: string; username?: string; setBalance: (b: number) => void; onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const tooLow = amount !== "" && n < limits.MIN_DEPOSIT;
  const tooHigh = n > limits.MAX_DEPOSIT;
  const valid = Number.isFinite(n) && n >= limits.MIN_DEPOSIT && n <= limits.MAX_DEPOSIT;

  const pay = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const order = await apiRequest<{ orderId: string; amount: number; currency: string; keyId: string }>("/payments/deposit", {
        body: { amount: n, provider: "razorpay" },
      });
      if (!(await loadRazorpayScript())) throw new Error("Couldn't load the payment window. Check your connection and try again.");

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency || "INR",
          order_id: order.orderId,
          name: "Aviator Game",
          description: "Wallet deposit",
          image: "/images/logo.svg",
          prefill: { name: username },
          theme: { color: "#f39c12" },
          modal: { ondismiss: () => reject(new Error("cancelled")) },
          handler: async (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              const v = await apiRequest<{ balance: number }>("/payments/razorpay/verify", {
                body: { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature },
              });
              setBalance(v.balance);
              resolve();
            } catch {
              reject(new Error(`Payment ${r.razorpay_payment_id} went through but isn't confirmed yet. Your balance will update shortly. If it doesn't, contact support with that payment ID.`));
            }
          },
        });
        // Razorpay lets the person retry inside its own window, so only tell them; ondismiss ends the attempt
        rzp.on("payment.failed", (r: any) => toast.error(`Payment failed: ${r?.error?.description || "the bank declined it"}. You can try again.`));
        rzp.open();
      });

      toast.success(`${formatMoney(n, currency)} added to your balance`);
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deposit failed. Try again.";
      if (msg !== "cancelled") toast.error(msg, { duration: 7000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wlt-panel">
      <div className="wlt-field">
        <label htmlFor="wlt-dep">Amount</label>
        <input
          id="wlt-dep" className="wlt-input" inputMode="decimal" autoFocus autoComplete="off"
          placeholder={`Minimum ${limits.MIN_DEPOSIT}`} value={amount}
          onChange={(e) => AMOUNT_PATTERN.test(e.target.value) && setAmount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && pay()}
        />
        <p className={`wlt-hint ${tooLow || tooHigh ? "is-error" : ""}`}>
          {tooHigh ? `Maximum deposit is ${formatMoney(limits.MAX_DEPOSIT, currency)}.` : `Minimum deposit is ${formatMoney(limits.MIN_DEPOSIT, currency)}.`}
        </p>
      </div>
      <div className="wlt-chips">
        {QUICK_AMOUNTS.filter((a) => a >= limits.MIN_DEPOSIT && a <= limits.MAX_DEPOSIT).map((a) => (
          <button key={a} type="button" className={`wlt-chip ${amount === String(a) ? "is-active" : ""}`} onClick={() => setAmount(String(a))}>
            {formatMoney(a, currency)}
          </button>
        ))}
      </div>
      <button className="wlt-primary" disabled={!valid || busy} onClick={pay}>
        {busy ? "Processing…" : valid ? `Deposit ${formatMoney(n, currency)}` : "Deposit"}
      </button>
      <p className="wlt-note">Pay with UPI, cards or net banking through Razorpay.</p>
    </div>
  );
}

/* ----------------------------- withdraw ------------------------------ */

function WithdrawPanel({ limits, currency, balance, setBalance }: {
  limits: ReturnType<typeof useLimits>; currency: string; balance: number; setBalance: (b: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("UPI");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<WithdrawalRow[] | null>(null);

  const load = useCallback(() => {
    apiRequest<WithdrawalRow[]>("/payments/withdrawals").then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const n = Number(amount);
  const tooLow = amount !== "" && n < limits.MIN_WITHDRAWAL;
  const tooMuch = n > balance;
  const cap = Math.min(balance, limits.MAX_WITHDRAWAL);
  const valid = Number.isFinite(n) && n >= limits.MIN_WITHDRAWAL && n <= cap && details.trim().length >= 4;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const r = await apiRequest<{ balance: number }>("/payments/withdraw", { body: { amount: n, method, accountDetails: details.trim() } });
      setBalance(r.balance);
      toast.success("Withdrawal requested. It's waiting for approval.");
      setAmount("");
      setDetails("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdrawal failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wlt-panel">
      <div className="wlt-field">
        <label htmlFor="wlt-wd">Amount</label>
        <input
          id="wlt-wd" className="wlt-input" inputMode="decimal" autoComplete="off"
          placeholder={`Minimum ${limits.MIN_WITHDRAWAL}`} value={amount}
          onChange={(e) => AMOUNT_PATTERN.test(e.target.value) && setAmount(e.target.value)}
        />
        <p className={`wlt-hint ${tooLow || tooMuch ? "is-error" : ""}`}>
          {tooMuch ? "That's more than your balance." : `Minimum withdrawal is ${formatMoney(limits.MIN_WITHDRAWAL, currency)}.`}
        </p>
      </div>

      <div className="wlt-methods" role="radiogroup" aria-label="Withdrawal method">
        {METHODS.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={method === m} className={`wlt-method ${method === m ? "is-active" : ""}`} onClick={() => setMethod(m)}>
            {m}
          </button>
        ))}
      </div>

      <div className="wlt-field">
        <label htmlFor="wlt-acct">{method === "UPI" ? "UPI ID" : "Account number and IFSC"}</label>
        <input
          id="wlt-acct" className="wlt-input" autoComplete="off" maxLength={200} value={details}
          placeholder={method === "UPI" ? "name@bank" : "000123456789, ABCD0001234"}
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>

      <button className="wlt-primary" disabled={!valid || busy} onClick={submit}>
        {busy ? "Sending request…" : "Request withdrawal"}
      </button>
      <p className="wlt-note">The amount is held from your balance right away. If a request is rejected, it goes back to you.</p>

      {rows && rows.length > 0 && (
        <ul className="wlt-list wlt-list--compact" aria-label="Your recent withdrawal requests">
          {rows.slice(0, 5).map((w) => (
            <li key={w.id} className="wlt-row">
              <div>
                <div className="wlt-row__title">{formatMoney(w.amount, w.currency)} via {w.method}</div>
                <div className="wlt-row__sub">{when(w.createdAt)}{w.adminNote ? ` · ${w.adminNote}` : ""}</div>
              </div>
              <span className={`wlt-badge is-${w.status}`}>{STATUS_LABEL[w.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------ history ------------------------------ */

function HistoryPanel({ currency }: { currency: string }) {
  const [rows, setRows] = useState<Txn[] | null>(null);
  useEffect(() => {
    apiRequest<Txn[]>("/payments/transactions?limit=40").then(setRows).catch(() => setRows([]));
  }, []);

  if (!rows) return <p className="wlt-empty">Loading…</p>;
  if (rows.length === 0) return <p className="wlt-empty">No wallet activity yet. Your first deposit will show up here.</p>;
  return (
    <ul className="wlt-list">
      {rows.map((t) => (
        <li key={t.id} className="wlt-row">
          <div>
            <div className="wlt-row__title">{TYPE_LABEL[t.type] ?? t.type}</div>
            <div className="wlt-row__sub">{when(t.createdAt)}</div>
          </div>
          <div className="wlt-row__right">
            <div className={`wlt-amt ${t.amount >= 0 ? "is-in" : "is-out"}`}>
              {t.amount >= 0 ? "+" : "−"}{formatMoney(Math.abs(t.amount), t.currency || currency)}
            </div>
            <div className="wlt-row__sub">{formatMoney(t.balanceAfter, t.currency || currency)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
