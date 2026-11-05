"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Context } from "@/context";
import { apiRequest } from "@/components/utils/api";
import {
  LayoutDashboard,
  Users,
  GamepadIcon,
  CreditCard,
  ChevronRight,
  TrendingUp,
  LogOut,
  Megaphone,
  Wallet,
  ArrowDownToLine,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type BadgeKey = "withdrawals" | "deposits";
const navItems: { title: string; href: string; icon: React.ElementType; badge?: BadgeKey }[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Games", href: "/admin/games", icon: GamepadIcon },
  { title: "Deposits", href: "/admin/payments", icon: ArrowDownToLine, badge: "deposits" },
  { title: "Withdrawals", href: "/admin/withdrawals", icon: Wallet, badge: "withdrawals" },
  { title: "Announcements", href: "/admin/announcements", icon: Megaphone },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const router = useRouter();
  const { logout } = React.useContext(Context);
  const [me, setMe] = React.useState<{ username: string; email: string } | null>(null);
  const [counts, setCounts] = React.useState<Record<BadgeKey, number>>({ withdrawals: 0, deposits: 0 });

  React.useEffect(() => {
    apiRequest<{ username: string; email: string }>("/users/me").then(setMe).catch(() => {});
    const load = () =>
      apiRequest<{ pendingWithdrawals: number; pendingDeposits: number }>("/admin/stats")
        .then((s) => setCounts({ withdrawals: s.pendingWithdrawals ?? 0, deposits: s.pendingDeposits ?? 0 }))
        .catch(() => {});
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  const handleLogout = async () => {
    try { await logout(); } finally { router.push("/"); }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5 bg-[#0a0e1a]">
      {/* Header */}
      <SidebarHeader className="border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 min-w-[2rem] items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/20">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">AviatorAdmin</span>
              <span className="text-[10px] text-white/40">Control Panel</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-2 pb-1">
              Navigation
            </SidebarGroupLabel>
          )}
          <SidebarMenu>
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.title}
                    className={`group relative rounded-lg transition-all duration-200 ${
                      active
                        ? "bg-gradient-to-r from-orange-500/20 to-red-500/10 text-orange-400 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-full before:bg-orange-500"
                        : "text-white/50 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Link href={item.href}>
                      <item.icon
                        className={`h-4 w-4 transition-colors ${active ? "text-orange-400" : "text-white/40 group-hover:text-white"}`}
                      />
                      <span>{item.title}</span>
                      {item.badge && counts[item.badge] > 0 && (
                        <span className="ml-auto rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white group-data-[collapsible=icon]:hidden">
                          {counts[item.badge] > 99 ? "99+" : counts[item.badge]}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-white/5 px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip="Admin Account"
                  className="text-white/50 hover:bg-white/5 hover:text-white"
                >
                  <Avatar className="h-7 w-7 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-orange-500/20 text-orange-400 text-xs uppercase">
                      {(me?.username ?? "ad").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <>
                      <div className="flex flex-col text-left leading-none">
                        <span className="text-xs font-medium text-white">{me?.username ?? "Admin"}</span>
                        <span className="max-w-[140px] truncate text-[10px] text-white/40">{me?.email ?? ""}</span>
                      </div>
                      <ChevronRight className="ml-auto h-3 w-3" />
                    </>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                className="w-48 bg-[#0d1224] border border-white/10 text-white"
              >
                <DropdownMenuItem onSelect={handleLogout} className="focus:bg-red-500/10 focus:text-red-400 cursor-pointer text-red-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
