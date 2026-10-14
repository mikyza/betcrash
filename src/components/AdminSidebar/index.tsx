"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GamepadIcon,
  CreditCard,
  Settings,
  ChevronRight,
  TrendingUp,
  LogOut,
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

const navItems = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Games", href: "/admin/games", icon: GamepadIcon },
  { title: "Deposits", href: "/admin/payments", icon: CreditCard },
  { title: "Withdrawals", href: "/admin/withdrawals", icon: CreditCard },
  { title: "Analytics", href: "/admin/analytics", icon: TrendingUp },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
                    <AvatarImage src="/avatars/admin.png" />
                    <AvatarFallback className="rounded-lg bg-orange-500/20 text-orange-400 text-xs">
                      AD
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <>
                      <div className="flex flex-col text-left leading-none">
                        <span className="text-xs font-medium text-white">Admin</span>
                        <span className="text-[10px] text-white/40">admin@aviator.com</span>
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
                <DropdownMenuItem className="focus:bg-white/5 focus:text-white cursor-pointer">
                  <Settings className="mr-2 h-4 w-4 text-white/40" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-red-500/10 focus:text-red-400 cursor-pointer text-red-400">
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
