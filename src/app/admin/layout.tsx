import type { Metadata } from "next";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminTopBar } from "@/components/AdminTopBar";
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
          <AdminTopBar />

          {/* Page Content - only admins get past the guard */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <AdminGuard>{children}</AdminGuard>
          </div>
        </main>
      </SidebarProvider>
    </div>
  );
}
