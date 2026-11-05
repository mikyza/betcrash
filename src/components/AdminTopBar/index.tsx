"use client";
import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import NotificationBell from "@/components/NotificationBell";

export function AdminTopBar() {
  const [date, setDate] = React.useState("");
  React.useEffect(() => {
    setDate(new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/5 bg-[#070b14]/80 px-4 backdrop-blur-sm">
      <SidebarTrigger className="text-white/50 hover:text-white hover:bg-white/5 -ml-1" />
      <div className="flex-1" />
      <span className="hidden text-[11px] text-white/30 sm:block">{date}</span>
      <Link
        href="/"
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        <span className="hidden sm:inline">Back to game</span>
      </Link>
      <NotificationBell />
    </header>
  );
}
