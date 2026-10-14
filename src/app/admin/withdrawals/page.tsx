"use client";
import React from "react";
import toast from "react-hot-toast";
import { CheckCircle, XCircle, Clock, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Withdrawal {
  id: string;
  userId: string;
  username: string;
  email: string;
  amount: number;
  currency: string;
  method: string;
  accountDetails: string;
  status: "pending" | "approved" | "rejected" | "processing";
  adminNote?: string;
  createdAt: string;
  processedAt?: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400", label: "Pending" },
    approved: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", label: "Approved" },
    rejected: { cls: "border-red-500/30 bg-red-500/10 text-red-400", label: "Rejected" },
    processing: { cls: "border-blue-500/30 bg-blue-500/10 text-blue-400", label: "Processing" },
  };
  const s = map[status] ?? map.pending;
  return <Badge variant="outline" className={`text-[10px] ${s.cls}`}>{s.label}</Badge>;
};

export default function AdminWithdrawalsPage() {
  const [items, setItems] = React.useState<Withdrawal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [actionTarget, setActionTarget] = React.useState<{ w: Withdrawal; type: "approve" | "reject" } | null>(null);
  const [adminNote, setAdminNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const fetchWithdrawals = async (f = filter) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("aviator_token") || "";
      const params = f !== "all" ? `?status=${f}` : "";
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/withdrawals${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      const data = body.data ?? body;
      setItems(Array.isArray(data) ? data : data.items ?? []);
    } catch { toast.error("Couldn't load withdrawals. Check your connection."); } finally { setLoading(false); }
  };

  React.useEffect(() => { fetchWithdrawals(); }, [filter]);

  const handleAction = async () => {
    if (!actionTarget) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("aviator_token") || "";
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/withdrawals/${actionTarget.w.id}/${actionTarget.type}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.data?.message || err?.message || "That action failed. Try again.");
      } else {
        toast.success(actionTarget.type === "approve" ? "Withdrawal approved" : "Withdrawal rejected and refunded");
        setActionTarget(null);
        setAdminNote("");
      }
      fetchWithdrawals();
    } catch {
      toast.error("Can't reach the server. Check your connection.");
    } finally { setSubmitting(false); }
  };

  const pendingTotal = items.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Withdrawals</h1>
          <p className="text-sm text-white/40">
            {items.filter((i) => i.status === "pending").length} pending • ₹{pendingTotal.toLocaleString("en-IN")} total
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "bg-orange-500 hover:bg-orange-600 text-white border-0"
                : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
            }
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <Card className="bg-[#0d1224] border border-white/5 text-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["User", "Amount", "Method", "Account", "Status", "Requested", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-white/30">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-5 py-3.5">
                            <div className="h-4 w-24 animate-pulse rounded bg-white/5" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : items.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-white/30">
                        <Clock className="mx-auto mb-2 h-8 w-8 text-white/10" />
                        No {filter !== "all" ? filter : ""} withdrawals
                      </td>
                    </tr>
                  )
                  : items.map((w) => (
                      <tr key={w.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-medium text-white">{w.username}</div>
                          <div className="text-[10px] text-white/30">{w.email}</div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-base font-bold text-white">
                            ₹{w.amount.toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant="outline" className="border-white/10 bg-white/5 text-white/50 text-[10px]">
                            {w.method}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-white/50 max-w-[160px] truncate">
                          {w.accountDetails}
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={w.status} /></td>
                        <td className="px-5 py-3 text-[11px] text-white/30">
                          {new Date(w.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-5 py-3">
                          {w.status === "pending" && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={() => { setActionTarget({ w, type: "approve" }); setAdminNote(""); }}
                                className="h-7 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => { setActionTarget({ w, type: "reject" }); setAdminNote(""); }}
                                className="h-7 px-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                          {w.adminNote && w.status !== "pending" && (
                            <span className="text-[10px] text-white/30 italic">{w.adminNote}</span>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={!!actionTarget} onOpenChange={() => setActionTarget(null)}>
        <DialogContent className="bg-[#0d1224] border border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className={actionTarget?.type === "approve" ? "text-emerald-400" : "text-red-400"}>
              {actionTarget?.type === "approve" ? "Approve" : "Reject"} Withdrawal
            </DialogTitle>
          </DialogHeader>
          {actionTarget && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-white/40 text-[10px] uppercase tracking-widest">Amount</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  ₹{actionTarget.w.amount.toLocaleString("en-IN")}
                </div>
                <div className="text-xs text-white/40 mt-0.5">
                  via {actionTarget.w.method} → {actionTarget.w.accountDetails}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Admin Note (optional)</Label>
                <Input
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Reason or reference ID…"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setActionTarget(null)} className="text-white/50 hover:text-white hover:bg-white/5">
              Cancel
            </Button>
            <Button
              disabled={submitting}
              onClick={handleAction}
              className={
                actionTarget?.type === "approve"
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }
            >
              {submitting ? "Processing…" : actionTarget?.type === "approve" ? "Approve & Release" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
