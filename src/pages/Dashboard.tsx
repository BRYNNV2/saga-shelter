import DashboardSidebar from "@/components/DashboardSidebar";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Archive,
  FileText,
  FolderOpen,
  TrendingUp,
  Clock,
  Search,
  Bell,
  User,
  ChevronRight,
  Settings,
  LogOut,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

const statusVariant = (status: string) => {
  switch (status) {
    case "Aktif": return "default";
    case "Review": return "secondary";
    case "Pending": return "outline";
    default: return "default";
  }
};

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: archives = [] } = useQuery({
    queryKey: ["archives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("archives")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["archive-stats"],
    queryFn: async () => {
      const { count: totalCount } = await supabase
        .from("archives")
        .select("*", { count: "exact", head: true });

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: monthCount } = await supabase
        .from("archives")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfMonth.toISOString());

      const { data: categories } = await supabase
        .from("archives")
        .select("category");

      const uniqueCategories = new Set(categories?.map((c) => c.category));

      return {
        total: totalCount ?? 0,
        thisMonth: monthCount ?? 0,
        categories: uniqueCategories.size,
      };
    },
  });

  const statCards = [
    { label: "Total Arsip", value: stats?.total ?? 0, icon: Archive, color: "bg-primary/10 text-primary" },
    { label: "Arsip Bulan Ini", value: stats?.thisMonth ?? 0, icon: FileText, color: "bg-accent/10 text-accent" },
    { label: "Kategori", value: stats?.categories ?? 0, icon: FolderOpen, color: "bg-success/10 text-success" },
  ];

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />

      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Selamat datang, {displayName}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari arsip..." className="pl-9 w-64 h-9" />
              </div>
              <NotificationBell variant="topbar" />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 w-9 rounded-full bg-primary flex items-center justify-center hover:ring-2 hover:ring-primary/20 transition-all focus:outline-none">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-2">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      {displayName && <p className="font-medium">{displayName}</p>}
                      {user?.email && (
                        <p className="w-[200px] truncate text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="cursor-pointer"
                    onClick={() => navigate("/dashboard/pengaturan")}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Pengaturan</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={async () => {
                      await signOut();
                      navigate("/login");
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Keluar</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {statCards.map((stat) => (
              <div key={stat.label} className="glass-card rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Archives */}
          <div className="glass-card rounded-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Arsip Terbaru</h2>
              </div>
            </div>
            {archives.length === 0 ? (
              <div className="p-12 text-center">
                <Archive className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">Belum ada arsip. Mulai tambahkan arsip Anda!</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {archives.map((archive) => (
                  <div
                    key={archive.id}
                    className="flex items-center justify-between p-5 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{archive.title}</p>
                        <p className="text-sm text-muted-foreground">{archive.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground hidden sm:block">
                        {format(new Date(archive.created_at), "dd MMM yyyy", { locale: localeId })}
                      </span>
                      <Badge variant={statusVariant(archive.status)}>{archive.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
