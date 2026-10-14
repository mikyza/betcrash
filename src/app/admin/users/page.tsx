"use client";
import React from "react";
import toast from "react-hot-toast";
import { Search, Shield, Ban, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface User {
  id: string;
  username: string;
  email: string;
  balance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  role: string;
  status: string;
  createdAt: string;
  lastSeen?: string;
}

const RoleBadge = ({ role }: { role: string }) => {
  const styles: Record<string, string> = {
    admin: "border-red-500/30 bg-red-500/10 text-red-400",
    moderator: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    user: "border-white/10 bg-white/5 text-white/50",
  };
  return <Badge variant="outline" className={`text-[10px] ${styles[role] ?? styles.user}`}>{role}</Badge>;
};

const StatusBadge = ({ status }: { status: string }) => {
  const active = status === "active";
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-red-400"}`} />
      <span className={`text-xs ${active ? "text-emerald-400" : "text-red-400"}`}>{status}</span>
    </div>
  );
};

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const limit = 20;

  const fetchUsers = async (q = search, p = page) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("aviator_token") || "";
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (q) params.set("search", q);
      const res = await fetch(`${BACKEND_URL}/api/v1/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      const data = body.data ?? body;
      setUsers(Array.isArray(data) ? data : data.items ?? []);
      setTotal(data.total ?? (Array.isArray(data) ? data.length : 0));
    } catch { toast.error("Couldn't load users. Check your connection."); } finally { setLoading(false); }
  };

  React.useEffect(() => { fetchUsers(); }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(search, 1);
  };

  const handleAction = async (userId: string, action: "ban" | "unban" | "makeAdmin") => {
    if (action === "ban" && !window.confirm("Ban this user? They are signed out right away and can't sign back in.")) return;
    if (action === "makeAdmin" && !window.confirm("Give this user full admin access?")) return;
    const token = localStorage.getItem("aviator_token") || "";
    const url =
      action === "ban" ? `${BACKEND_URL}/api/v1/admin/users/${userId}/ban`
      : action === "unban" ? `${BACKEND_URL}/api/v1/admin/users/${userId}/unban`
      : `${BACKEND_URL}/api/v1/admin/users/${userId}/role`;
    const body = action === "makeAdmin" ? JSON.stringify({ role: "admin" }) : undefined;
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.data?.message || err?.message || "That action failed. Try again.");
        return;
      }
      toast.success(action === "ban" ? "User banned" : action === "unban" ? "User unbanned" : "User is now an admin");
    } catch {
      toast.error("Can't reach the server. Check your connection.");
    }
    fetchUsers();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-sm text-white/40">{total.toLocaleString()} registered accounts</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username or email…"
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500/50"
          />
        </div>
        <Button type="submit" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
          Search
        </Button>
      </form>

      {/* Table */}
      <Card className="bg-[#0d1224] border border-white/5 text-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["User", "Balance", "Deposits", "Withdrawals", "Role", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-white/30">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-5 py-3.5">
                            <div className="h-4 w-24 animate-pulse rounded bg-white/5" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : users.length === 0
                  ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-sm text-white/30">
                        No users found
                      </td>
                    </tr>
                  )
                  : users.map((u) => (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7 rounded-lg">
                              <AvatarFallback className="rounded-lg bg-orange-500/10 text-orange-400 text-[10px]">
                                {u.username.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-white text-sm">{u.username}</div>
                              <div className="text-[10px] text-white/30">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 tabular-nums text-white/80">₹{u.balance?.toLocaleString("en-IN") ?? 0}</td>
                        <td className="px-5 py-3 tabular-nums text-emerald-400">₹{u.totalDeposits?.toLocaleString("en-IN") ?? 0}</td>
                        <td className="px-5 py-3 tabular-nums text-red-400">₹{u.totalWithdrawals?.toLocaleString("en-IN") ?? 0}</td>
                        <td className="px-5 py-3"><RoleBadge role={u.role} /></td>
                        <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
                        <td className="px-5 py-3 text-[11px] text-white/30">
                          {new Date(u.createdAt).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-5 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-white/40 hover:text-white hover:bg-white/5">
                                •••
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-[#0d1224] border border-white/10 text-white" side="left">
                              {u.status === "active" ? (
                                <DropdownMenuItem
                                  className="focus:bg-red-500/10 focus:text-red-400 cursor-pointer text-red-400"
                                  onClick={() => handleAction(u.id, "ban")}
                                >
                                  <Ban className="mr-2 h-4 w-4" /> Ban User
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer text-emerald-400"
                                  onClick={() => handleAction(u.id, "unban")}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" /> Unban User
                                </DropdownMenuItem>
                              )}
                              {u.role !== "admin" && (
                                <DropdownMenuItem
                                  className="focus:bg-orange-500/10 focus:text-orange-400 cursor-pointer"
                                  onClick={() => handleAction(u.id, "makeAdmin")}
                                >
                                  <Shield className="mr-2 h-4 w-4" /> Make Admin
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
              <span className="text-xs text-white/30">
                Page {page} of {totalPages} ({total} users)
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm" variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-7 w-7 p-0 text-white/40 hover:text-white disabled:opacity-20"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm" variant="ghost"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 w-7 p-0 text-white/40 hover:text-white disabled:opacity-20"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
