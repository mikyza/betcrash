"use client";
import React from "react";
import {
  Users,
  GamepadIcon,
  TrendingUp,
  CreditCard,
  ArrowUp,
  ArrowDown,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalGames: number;
  activeGame: { id: string; status: string; multiplier: number } | null;
  houseProfitToday: number;
  totalBetsToday: number;
  pendingWithdrawals: number;
  pendingAmount: number;
}

const defaultStats: Stats = {
  totalUsers: 0,
  activeUsers: 0,
  totalGames: 0,
  activeGame: null,
  houseProfitToday: 0,
  totalBetsToday: 0,
  pendingWithdrawals: 0,
  pendingAmount: 0,
};

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  accent,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: { value: number; up: boolean };
  accent?: string;
}) {
  return (
    <Card className="bg-[#0d1224] border border-white/5 text-white">
      <CardHeader className="flex flex-row items-start justify-between pb-2 pt-4 px-4">
        <CardTitle className="text-[11px] font-medium uppercase tracking-widest text-white/40">
          {title}
        </CardTitle>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent || "bg-orange-500/10"}`}
        >
          <Icon className={`h-4 w-4 ${accent ? "text-white" : "text-orange-400"}`} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {(sub || trend) && (
          <div className="flex items-center gap-1 mt-1">
            {trend && (
              <span
                className={`flex items-center gap-0.5 text-[11px] font-medium ${
                  trend.up ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {trend.up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {trend.value}%
              </span>
            )}
            {sub && <span className="text-[11px] text-white/30">{sub}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RecentGame {
  id: string;
  gameNumber: number;
  crashPoint: number;
  totalBets: number;
  totalPayout: number;
  houseProfit: number;
  startedAt: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = React.useState<Stats>(defaultStats);
  const [recentGames, setRecentGames] = React.useState<RecentGame[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchDashboard = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("aviator_token") : "";
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const [statsRes, gamesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/admin/stats`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/admin/games?limit=5`, { headers }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json().then((r) => r.data ?? r));
      if (gamesRes.ok) setRecentGames(await gamesRes.json().then((r) => Array.isArray(r.data) ? r.data : r.data?.items ?? []));
    } catch {
      // fallback to default
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDashboard();
    const iv = setInterval(fetchDashboard, 15000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-white/40">Real-time platform overview</p>
      </div>

      {/* Live Game Banner */}
      {stats.activeGame && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
          <div className="flex h-2 w-2 rounded-full bg-orange-500">
            <div className="h-2 w-2 animate-ping rounded-full bg-orange-500 opacity-75" />
          </div>
          <Activity className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-medium text-orange-300">
            Game #{stats.activeGame.id.slice(-6)} LIVE — {stats.activeGame.status.toUpperCase()} @ {stats.activeGame.multiplier.toFixed(2)}x
          </span>
          <Badge variant="outline" className="ml-auto border-orange-500/30 text-orange-400 text-[10px]">
            LIVE
          </Badge>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={loading ? "—" : stats.totalUsers.toLocaleString()}
          sub="registered accounts"
          icon={Users}
          accent="bg-blue-500/10"
        />
        <StatCard
          title="Online Now"
          value={loading ? "—" : stats.activeUsers.toLocaleString()}
          sub="active sessions"
          icon={Activity}
          accent="bg-emerald-500/10"
        />
        <StatCard
          title="House Profit Today"
          value={loading ? "—" : `₹${stats.houseProfitToday.toLocaleString("en-IN")}`}
          sub={`${stats.totalBetsToday} bets`}
          icon={TrendingUp}
        />
        <StatCard
          title="Pending Withdrawals"
          value={loading ? "—" : stats.pendingWithdrawals}
          sub={`₹${stats.pendingAmount.toLocaleString("en-IN")} total`}
          icon={CreditCard}
          accent={stats.pendingWithdrawals > 10 ? "bg-red-500/10" : "bg-yellow-500/10"}
        />
      </div>

      {/* Recent Games */}
      <Card className="bg-[#0d1224] border border-white/5 text-white">
        <CardHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Games</CardTitle>
            <a href="/admin/games" className="text-[11px] text-orange-400 hover:text-orange-300 transition-colors">
              View all →
            </a>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["Game #", "Crash Point", "Total Bets", "Payout", "Profit", "Time"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-white/30">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-5 py-3">
                            <div className="h-4 w-20 animate-pulse rounded bg-white/5" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : recentGames.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-white/30">
                        No games yet
                      </td>
                    </tr>
                  )
                  : recentGames.map((g) => (
                      <tr key={g.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 font-mono text-xs text-white/60">#{g.gameNumber}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`font-bold tabular-nums ${
                              g.crashPoint < 1.5 ? "text-red-400" : g.crashPoint < 3 ? "text-yellow-400" : "text-emerald-400"
                            }`}
                          >
                            {g.crashPoint.toFixed(2)}x
                          </span>
                        </td>
                        <td className="px-5 py-3 text-white/60">{g.totalBets}</td>
                        <td className="px-5 py-3 text-white/60">₹{g.totalPayout?.toLocaleString("en-IN") ?? 0}</td>
                        <td className="px-5 py-3">
                          <span className={g.houseProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                            {g.houseProfit >= 0 ? "+" : ""}₹{g.houseProfit?.toLocaleString("en-IN") ?? 0}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-white/40 text-xs">
                          {g.startedAt ? new Date(g.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
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
