import DashboardSidebar from "@/components/DashboardSidebar";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const stats = [
  {
    label: "Total Arsip",
    value: "2,847",
    change: "+12%",
    icon: Archive,
    color: "bg-primary/10 text-primary",
  },
  {
    label: "Arsip Bulan Ini",
    value: "184",
    change: "+8%",
    icon: FileText,
    color: "bg-accent/10 text-accent",
  },
  {
    label: "Kategori",
    value: "24",
    change: "+2",
    icon: FolderOpen,
    color: "bg-success/10 text-success",
  },
  {
    label: "Diakses Hari Ini",
    value: "56",
    change: "+15%",
    icon: TrendingUp,
    color: "bg-info/10 text-info",
  },
];

const recentArchives = [
  {
    id: 1,
    title: "Surat Keputusan No. 045/2024",
    category: "Surat Keputusan",
    date: "23 Feb 2026",
    status: "Aktif",
  },
  {
    id: 2,
    title: "Laporan Keuangan Q4 2025",
    category: "Laporan",
    date: "20 Feb 2026",
    status: "Aktif",
  },
  {
    id: 3,
    title: "MoU Kerjasama PT Maju Bersama",
    category: "Perjanjian",
    date: "18 Feb 2026",
    status: "Review",
  },
  {
    id: 4,
    title: "Notulensi Rapat Direksi #12",
    category: "Notulensi",
    date: "15 Feb 2026",
    status: "Aktif",
  },
  {
    id: 5,
    title: "Proposal Pengadaan Inventaris",
    category: "Proposal",
    date: "12 Feb 2026",
    status: "Pending",
  },
];

const statusVariant = (status: string) => {
  switch (status) {
    case "Aktif":
      return "default";
    case "Review":
      return "secondary";
    case "Pending":
      return "outline";
    default:
      return "default";
  }
};

const Dashboard = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />

      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Selamat datang kembali, Admin</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari arsip..." className="pl-9 w-64 h-9" />
              </div>
              <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-accent rounded-full border-2 border-background" />
              </button>
              <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="glass-card rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3">
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                  <span className="text-xs font-medium text-success">{stat.change}</span>
                  <span className="text-xs text-muted-foreground">dari bulan lalu</span>
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
              <button className="text-sm text-accent font-medium hover:underline flex items-center gap-1">
                Lihat Semua <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y divide-border">
              {recentArchives.map((archive) => (
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
                    <span className="text-sm text-muted-foreground hidden sm:block">{archive.date}</span>
                    <Badge variant={statusVariant(archive.status)}>{archive.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
