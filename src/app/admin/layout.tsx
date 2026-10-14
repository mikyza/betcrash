import type { Metadata } from "next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminGuard } from "@/components/AdminGuard";

export const metadata: Metadata = {
  title: "Aviator Admin",
  description: "Aviator game admin control panel",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <SidebarProvider>
        <AdminSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-white/5 bg-[#070b14]/80 px-4 backdrop-blur-sm">
            <SidebarTrigger className="text-white/50 hover:text-white hover:bg-white/5 -ml-1" />
            <div className="h-px w-px flex-1" />
            <span className="text-[11px] text-white/30">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </header>

          {/* Page Content - only admins get past the guard */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <AdminGuard>{children}</AdminGuard>
          </div>
        </main>
      </SidebarProvider>
    </div>
  );
}
