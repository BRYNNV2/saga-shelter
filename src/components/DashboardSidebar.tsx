import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Archive,
  LayoutDashboard,
  FileText,
  FolderOpen,
  Upload,
  Settings,
  LogOut,
  ChevronLeft,
  BarChart2,
  Search,
  History,
  Moon,
  Sun,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { useTheme } from "@/hooks/useTheme";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FileText, label: "Berkas KK", path: "/dashboard/berkas-kk" },
  { icon: FileText, label: "Berkas KTP", path: "/dashboard/berkas-ktp" },
  { icon: FolderOpen, label: "Semua Arsip", path: "/dashboard/arsip" },
  { icon: Upload, label: "Upload Arsip", path: "/dashboard/upload" },
  { icon: BarChart2, label: "Laporan", path: "/dashboard/laporan" },
  { icon: History, label: "Riwayat", path: "/dashboard/riwayat" },
  { icon: Settings, label: "Pengaturan", path: "/dashboard/pengaturan" },
];

const DashboardSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Global keyboard shortcut Ctrl+K / Cmd+K
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Toggle Button (Visible only on small screens) */}
      {!isMobileOpen && (
        <button
          onClick={() => setIsMobileOpen(true)}
          className="md:hidden fixed bottom-6 right-6 z-40 p-4 rounded-full bg-primary text-primary-foreground shadow-[0_4px_14px_0_rgba(0,0,0,0.25)] hover:shadow-[0_6px_20px_0_rgba(0,0,0,0.3)] transition-all flex items-center justify-center animate-in fade-in"
        >
          <Menu className="h-6 w-6" />
        </button>
      )}

      <aside
        className={cn(
          "h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 z-50 overflow-y-auto",
          // Responsiveness: Fixed on mobile, sticky on desktop
          "fixed md:sticky top-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Logo & Close Button (Mobile) */}
        <div className="flex items-center justify-between p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sidebar-primary shrink-0 relative overflow-hidden group">
              <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform rounded-lg" />
              <Archive className="h-5 w-5 text-sidebar-primary-foreground relative z-10" />
            </div>
            {!collapsed && <span className="text-lg font-bold truncate tracking-tight">ArsipKu</span>}
          </div>
          {/* Mobile close explicit button */}
          <button 
            className="md:hidden p-1.5 rounded-md hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
            onClick={() => setIsMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Button */}
        <div className="px-3 pt-3">
          <button
            onClick={() => setSearchOpen(true)}
            title="Pencarian Global (Ctrl+K)"
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200",
              "bg-sidebar-accent/40 hover:bg-sidebar-accent/70 text-sidebar-foreground/70 hover:text-sidebar-foreground border border-sidebar-border/50 group"
            )}
          >
            <Search className="h-4 w-4 shrink-0 group-hover:scale-110 transition-transform" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70 transition-colors">Cari...</span>
                <kbd className="text-[10px] font-mono bg-sidebar-border/60 px-1.5 py-0.5 rounded text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 transition-colors">
                  ⌃K
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 mt-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-sidebar-primary rounded-r-md" />
                )}
                <item.icon className={cn("h-5 w-5 shrink-0 transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-1 mt-auto">
          {/* Notification Bell */}
          <NotificationBell collapsed={collapsed} />

          {/* Dark / Light toggle */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all group"
          >
            {theme === "dark"
              ? <Sun className="h-5 w-5 shrink-0 group-hover:rotate-45 transition-transform" />
              : <Moon className="h-5 w-5 shrink-0 group-hover:-rotate-12 transition-transform" />}
            {!collapsed && <span>{theme === "dark" ? "Mode Terang" : "Mode Gelap"}</span>}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group"
          >
            <ChevronLeft className={cn("h-5 w-5 shrink-0 transition-transform duration-300", collapsed && "rotate-180")} />
            {!collapsed && <span>Kecilkan</span>}
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-all focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-destructive group"
          >
            <LogOut className="h-5 w-5 shrink-0 group-hover:translate-x-1 transition-transform" />
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Global Search Modal */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};

export default DashboardSidebar;
