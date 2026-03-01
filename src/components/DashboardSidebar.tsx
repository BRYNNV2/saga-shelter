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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { useTheme } from "@/hooks/useTheme";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FileText, label: "Berkas KK", path: "/dashboard/berkas-kk" },
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
      <aside
        className={cn(
          "h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 sticky top-0",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-5 border-b border-sidebar-border">
          <div className="p-2 rounded-lg bg-sidebar-primary shrink-0">
            <Archive className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && <span className="text-lg font-bold truncate">ArsipKu</span>}
        </div>

        {/* Search Button */}
        <div className="px-3 pt-3">
          <button
            onClick={() => setSearchOpen(true)}
            title="Pencarian Global (Ctrl+K)"
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200",
              "bg-sidebar-accent/40 hover:bg-sidebar-accent/70 text-sidebar-foreground/70 hover:text-sidebar-foreground border border-sidebar-border/50"
            )}
          >
            <Search className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left text-sidebar-foreground/50">Cari...</span>
                <kbd className="text-[10px] font-mono bg-sidebar-border/60 px-1.5 py-0.5 rounded text-sidebar-foreground/40">
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
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          {/* Notification Bell */}
          <NotificationBell collapsed={collapsed} />

          {/* Dark / Light toggle */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all"
          >
            {theme === "dark"
              ? <Sun className="h-5 w-5 shrink-0" />
              : <Moon className="h-5 w-5 shrink-0" />}
            {!collapsed && <span>{theme === "dark" ? "Mode Terang" : "Mode Gelap"}</span>}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all"
          >
            <ChevronLeft className={cn("h-5 w-5 shrink-0 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span>Kecilkan</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive transition-all"
          >
            <LogOut className="h-5 w-5 shrink-0" />
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
