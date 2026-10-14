"use client";
import React from "react";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Game {
  id: string;
  gameNumber: number;
  crashPoint: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  totalBets: number;
  totalWagered: number;
  totalPayout: number;
  houseProfit: number;
  activePlayers: number;
  status: "betting" | "playing" | "crashed";
  startedAt: string;
  endedAt?: string;
}

export default function AdminGamesPage() {
  const [games, setGames] = React.useState<Game[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<Game | null>(null);
  const limit = 25;

  const fetchGames = async (p = page) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("aviator_token") || "";
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/games?page=${p}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      const data = body.data ?? body;
      setGames(Array.isArray(data) ? data : data.items ?? []);
      setTotal(data.total ?? (Array.isArray(data) ? data.length : 0));
    } catch { toast.error("Couldn't load games. Check your connection."); } finally { setLoading(false); }
  };

  React.useEffect(() => { fetchGames(); }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Game History</h1>
        <p className="text-sm text-white/40">{total.toLocaleString()} total rounds played</p>
      </div>

      <Card className="bg-[#0d1224] border border-white/5 text-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["#", "Crash", "Players", "Wagered", "Payout", "Profit", "Date", ""].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-white/30">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-5 py-3.5">
                            <div className="h-4 w-20 animate-pulse rounded bg-white/5" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : games.length === 0
                  ? (<tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-white/30">No games yet</td></tr>)
                  : games.map((g) => (
                      <tr key={g.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 font-mono text-xs text-white/50">#{g.gameNumber}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`text-base font-bold tabular-nums ${
                              g.crashPoint < 1.5 ? "text-red-400" : g.crashPoint < 2 ? "text-yellow-400" : g.crashPoint < 5 ? "text-emerald-400" : "text-blue-400"
                            }`}
                          >
                            {g.crashPoint?.toFixed(2)}x
                          </span>
                        </td>
                        <td className="px-5 py-3 text-white/60">{g.activePlayers ?? g.totalBets}</td>
                        <td className="px-5 py-3 tabular-nums text-white/60">₹{g.totalWagered?.toLocaleString("en-IN") ?? 0}</td>
                        <td className="px-5 py-3 tabular-nums text-white/60">₹{g.totalPayout?.toLocaleString("en-IN") ?? 0}</td>
                        <td className="px-5 py-3 tabular-nums">
                          <span className={g.houseProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                            {g.houseProfit >= 0 ? "+" : ""}₹{g.houseProfit?.toLocaleString("en-IN") ?? 0}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[11px] text-white/30">
                          {g.startedAt ? new Date(g.startedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => setSelected(g)}
                            className="h-7 w-7 p-0 text-white/30 hover:text-white hover:bg-white/5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
              <span className="text-xs text-white/30">Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-7 w-7 p-0 text-white/40 hover:text-white disabled:opacity-20">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-7 w-7 p-0 text-white/40 hover:text-white disabled:opacity-20">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Game Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-[#0d1224] border border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Game #{selected?.gameNumber} — Crash @ {selected?.crashPoint?.toFixed(2)}x
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Game ID", value: selected.id },
                  { label: "Status", value: selected.status },
                  { label: "Total Bets", value: selected.totalBets },
                  { label: "Wagered", value: `₹${selected.totalWagered?.toLocaleString("en-IN") ?? 0}` },
                  { label: "Payout", value: `₹${selected.totalPayout?.toLocaleString("en-IN") ?? 0}` },
                  { label: "House Profit", value: `₹${selected.houseProfit?.toLocaleString("en-IN") ?? 0}` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-white/30">{label}</div>
                    <div className="mt-1 font-mono text-xs text-white break-all">{String(value)}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-white/5 p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-widest text-white/30">Provably Fair</div>
                <div>
                  <div className="text-[10px] text-white/40">Server Seed Hash</div>
                  <div className="font-mono text-[11px] text-white/60 break-all">{selected.serverSeedHash || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/40">Server Seed (revealed)</div>
                  <div className="font-mono text-[11px] text-emerald-400 break-all">{selected.serverSeed || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/40">Client Seed</div>
                  <div className="font-mono text-[11px] text-white/60 break-all">{selected.clientSeed || "—"}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
