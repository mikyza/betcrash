"use client";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
type Item = { id: string; username: string; phone: string; amount: number; currency: string; status: "pending" | "paid" | "failed"; reference?: string; receipt?: string; failureReason?: string; createdAt: string };
const cls: Record<string, string> = { pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400", paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", failed: "border-red-500/30 bg-red-500/10 text-red-400" };

export default function AdminPayments() {
  const [items, setItems] = React.useState<Item[]>([]);
  const [filter, setFilter] = React.useState<"pending" | "paid" | "failed" | "all">("pending");
  const [loading, setLoading] = React.useState(true);
  const token = () => localStorage.getItem("aviator_token") || "";

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/v1/admin/payments${filter === "all" ? "" : `?status=${filter}`}`, { headers: { Authorization: `Bearer ${token()}` } });
      const b = await r.json();
      setItems(b?.data?.items || []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [filter]);
  React.useEffect(() => { load(); }, [load]);

  const act = async (id: string, kind: "credit" | "fail") => {
    let body = "{}";
    if (kind === "credit") {
      const receipt = prompt("Only credit after you SAW the money in PayHero / M-Pesa statement.\nEnter the M-Pesa receipt code (e.g. SAB1C2D3E4):");
      if (!receipt) return;
      body = JSON.stringify({ receipt });
    } else if (!confirm("Mark this deposit as failed? The player will not be credited.")) return;
    const r = await fetch(`${BACKEND_URL}/api/v1/admin/payments/${id}/${kind}`, { method: "PATCH", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body });
    if (!r.ok) { const b = await r.json().catch(() => ({})); alert(b?.data?.message || "Action failed"); }
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Deposits</h1>
        <p className="text-sm text-white/40">M-Pesa STK deposits. Pending ones normally confirm by themselves within a minute; use the buttons only to fix a stuck one.</p>
      </div>
      <div className="flex gap-2">
        {(["pending", "paid", "failed", "all"] as const).map((f) => (
          <Button key={f} size="sm" onClick={() => setFilter(f)} className={filter === f ? "bg-orange-500 hover:bg-orange-600 text-white border-0" : "border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}>{f.charAt(0).toUpperCase() + f.slice(1)}</Button>
        ))}
      </div>
      <Card className="bg-[#0d1224] border border-white/5 text-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5">{["Player", "Phone", "Amount", "Status", "Receipt / note", "Created", "Actions"].map((h) => <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-white/30">{h}</th>)}</tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="px-5 py-8 text-center text-white/30">Loading...</td></tr>
                  : items.length === 0 ? <tr><td colSpan={7} className="px-5 py-8 text-center text-white/30">Nothing here</td></tr>
                  : items.map((p) => (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="px-5 py-3 font-medium">{p.username}</td>
                      <td className="px-5 py-3 text-white/60">{p.phone}</td>
                      <td className="px-5 py-3 font-semibold">{p.currency} {p.amount.toLocaleString("en-KE")}</td>
                      <td className="px-5 py-3"><Badge variant="outline" className={cls[p.status]}>{p.status}</Badge></td>
                      <td className="px-5 py-3 text-xs text-white/50">{p.receipt || p.failureReason || "-"}</td>
                      <td className="px-5 py-3 text-xs text-white/40">{new Date(p.createdAt).toLocaleString("en-KE")}</td>
                      <td className="px-5 py-3">
                        {p.status !== "paid" && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => act(p.id, "credit")} className="h-7 px-2 text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Credit</Button>
                            {p.status === "pending" && <Button size="sm" onClick={() => act(p.id, "fail")} className="h-7 px-2 text-[11px] bg-red-500/10 text-red-400 border border-red-500/20">Fail</Button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
