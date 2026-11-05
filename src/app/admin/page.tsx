"use client";
import React from "react";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  CreditCard,
  ArrowUp,
  ArrowDown,
  Activity,
  ArrowDownToLine,
  Wallet,
  UserPlus,
  Megaphone,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { Context } from "@/context";
import { apiRequest } from "@/components/utils/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Stats {
  currency: string;
  newUsersToday: number;
  pendingDeposits: number;
  depositsToday: number;
  depositsTodayCount: number;
  withdrawnToday: number;
  withdrawnTodayCount: number;
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
  currency: "KES",
  newUsersToday: 0,
  pendingDeposits: 0,
  depositsToday: 0,
  depositsTodayCount: 0,
  withdrawnToday: 0,
  withdrawnTodayCount: 0,
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

  const [failed, setFailed] = React.useState(false);
  const money = (n: number) => `${stats.currency} ${Number(n).toLocaleString("en-KE")}`;
  const { notifications } = React.useContext(Context);

  const fetchDashboard = async () => {
    try {
      const [st, gm] = await Promise.all([
        apiRequest<Stats>("/admin/stats"),
        apiRequest<{ items: RecentGame[] }>("/admin/games?limit=5"),
      ]);
      setStats({ ...defaultStats, ...st });
      setRecentGames(gm.items ?? []);
      setFailed(false);
    } catch {
      setFailed(true);
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
            Round LIVE — {stats.activeGame.status?.toUpperCase()} @ {Number(stats.activeGame.multiplier ?? 1).toFixed(2)}x
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
          value={loading ? "—" : `${money(stats.houseProfitToday)}`}
          sub={`${stats.totalBetsToday} bets`}
          icon={TrendingUp}
        />
        <StatCard
          title="Pending Withdrawals"
          value={loading ? "—" : stats.pendingWithdrawals}
          sub={`${money(stats.pendingAmount)} total`}
          icon={CreditCard}
          accent={stats.pendingWithdrawals > 10 ? "bg-red-500/10" : "bg-yellow-500/10"}
        />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Deposits Today" value={loading ? "—" : money(stats.depositsToday)} sub={`${stats.depositsTodayCount} paid`} icon={ArrowDownToLine} accent="bg-emerald-500/10" />
        <StatCard title="Paid Out Today" value={loading ? "—" : money(stats.withdrawnToday)} sub={`${stats.withdrawnTodayCount} withdrawals`} icon={Wallet} accent="bg-blue-500/10" />
        <StatCard title="New Players Today" value={loading ? "—" : stats.newUsersToday} sub="signed up" icon={UserPlus} accent="bg-purple-500/10" />
        <StatCard title="Rounds Played" value={loading ? "—" : stats.totalGames.toLocaleString()} sub="all time" icon={Activity} accent="bg-orange-500/10" />
      </div>

      {failed && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          Couldn&apos;t load the latest numbers. Retrying automatically…
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Needs attention */}
        <Card className="bg-[#0d1224] border border-white/5 text-white">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold">Needs your attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-5 pb-5">
            {stats.pendingWithdrawals === 0 && stats.pendingDeposits === 0 ? (
              <div className="flex items-center gap-2 py-4 text-sm text-white/40">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Nothing waiting. All caught up.
              </div>
            ) : (
              <>
                {stats.pendingWithdrawals > 0 && (
                  <Link href="/admin/withdrawals" className="flex items-center gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5 transition-colors hover:bg-yellow-500/10">
                    <Wallet className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm">
                      <b>{stats.pendingWithdrawals}</b> withdrawal{stats.pendingWithdrawals > 1 ? "s" : ""} to approve
                      <span className="text-white/40"> · {money(stats.pendingAmount)}</span>
                    </span>
                    <ChevronRight className="ml-auto h-4 w-4 text-white/30" />
                  </Link>
                )}
                {stats.pendingDeposits > 0 && (
                  <Link href="/admin/payments" className="flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 transition-colors hover:bg-blue-500/10">
                    <ArrowDownToLine className="h-4 w-4 text-blue-400" />
                    <span className="text-sm"><b>{stats.pendingDeposits}</b> deposit{stats.pendingDeposits > 1 ? "s" : ""} still pending</span>
                    <ChevronRight className="ml-auto h-4 w-4 text-white/30" />
                  </Link>
                )}
              </>
            )}
            <Link href="/admin/announcements" className="flex items-center gap-3 rounded-lg border border-white/5 px-3 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white">
              <Megaphone className="h-4 w-4 text-orange-400" /> Send an announcement to players online
              <ChevronRight className="ml-auto h-4 w-4 text-white/30" />
            </Link>
          </CardContent>
        </Card>

        {/* Recent notifications */}
        <Card className="bg-[#0d1224] border border-white/5 text-white">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {notifications.length === 0 ? (
              <p className="py-4 text-sm text-white/30">New signups and withdrawal requests will appear here.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {notifications.slice(0, 5).map((n) => (
                  <li key={n.id} className="py-2.5">
                    <div className="flex items-center gap-2">
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
                      <span className="text-sm font-medium">{n.title}</span>
                      <span className="ml-auto text-[10px] text-white/30">{new Date(n.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {n.message && <p className="mt-0.5 text-xs text-white/40">{n.message}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
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
                        <td className="px-5 py-3 text-white/60">{money(g.totalPayout ?? 0)}</td>
                        <td className="px-5 py-3">
                          <span className={g.houseProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                            {g.houseProfit >= 0 ? "+" : "-"}{money(Math.abs(g.houseProfit ?? 0))}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-white/40 text-xs">
                          {g.startedAt ? new Date(g.startedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }) : "—"}
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
