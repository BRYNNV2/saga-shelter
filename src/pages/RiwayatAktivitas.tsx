import DashboardSidebar from "@/components/DashboardSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
    History,
    Upload,
    Trash2,
    FileSearch,
    FilePlus,
    Pencil,
    FileSpreadsheet,
    Download,
    LogIn,
    Filter,
    X,
    Loader2,
    Clock,
    ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { format, formatDistanceToNow, isToday, isYesterday, startOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ─── Config ───
const ACTION_CONFIG: Record<
    string,
    { label: string; icon: React.ElementType; color: string; badgeVariant: "default" | "secondary" | "outline" | "destructive" }
> = {
    upload: { label: "Upload", icon: Upload, color: "bg-blue-500/10 text-blue-500", badgeVariant: "secondary" },
    create: { label: "Tambah", icon: FilePlus, color: "bg-green-500/10 text-green-600", badgeVariant: "default" },
    edit: { label: "Edit", icon: Pencil, color: "bg-amber-500/10 text-amber-500", badgeVariant: "secondary" },
    delete: { label: "Hapus", icon: Trash2, color: "bg-red-500/10 text-red-500", badgeVariant: "destructive" },
    scan: { label: "Scan KK", icon: FileSearch, color: "bg-purple-500/10 text-purple-500", badgeVariant: "secondary" },
    import: { label: "Import", icon: FileSpreadsheet, color: "bg-teal-500/10 text-teal-600", badgeVariant: "secondary" },
    export: { label: "Export", icon: Download, color: "bg-indigo-500/10 text-indigo-500", badgeVariant: "secondary" },
    login: { label: "Login", icon: LogIn, color: "bg-gray-500/10 text-gray-500", badgeVariant: "outline" },
};

const ENTITY_LABEL: Record<string, string> = {
    arsip: "Arsip",
    kk: "Berkas KK",
    system: "Sistem",
};

const ACTION_OPTIONS = ["semua", "upload", "create", "edit", "delete", "scan", "import", "export", "login"];
const ENTITY_OPTIONS = ["semua", "arsip", "kk", "system"];
const PAGE_SIZE = 20;

// ─── Helpers ───
const groupByDate = (items: any[]) => {
    const groups: Record<string, any[]> = {};
    items.forEach((item) => {
        const d = new Date(item.created_at);
        const key = isToday(d)
            ? "Hari Ini"
            : isYesterday(d)
                ? "Kemarin"
                : format(startOfDay(d), "EEEE, dd MMMM yyyy", { locale: localeId });
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
};

// ─── Component ───
const RiwayatAktivitas = () => {
    const [search, setSearch] = useState("");
    const [filterAction, setFilterAction] = useState("semua");
    const [filterEntity, setFilterEntity] = useState("semua");
    const [page, setPage] = useState(1);

    const { data: logs = [], isLoading } = useQuery({
        queryKey: ["activity-logs"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("activity_logs")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(200);
            if (error) throw error;
            return data ?? [];
        },
    });

    // Client-side filter
    const filtered = logs.filter((log: any) => {
        const matchSearch =
            !search ||
            log.description?.toLowerCase().includes(search.toLowerCase()) ||
            log.entity_name?.toLowerCase().includes(search.toLowerCase());
        const matchAction = filterAction === "semua" || log.action === filterAction;
        const matchEntity = filterEntity === "semua" || log.entity_type === filterEntity;
        return matchSearch && matchAction && matchEntity;
    });

    const paginated = filtered.slice(0, page * PAGE_SIZE);
    const hasMore = filtered.length > paginated.length;
    const grouped = groupByDate(paginated);

    const hasFilter = filterAction !== "semua" || filterEntity !== "semua" || search !== "";

    const resetFilter = () => {
        setSearch("");
        setFilterAction("semua");
        setFilterEntity("semua");
        setPage(1);
    };

    // Summary counts
    const countBy = (key: string, val: string) =>
        logs.filter((l: any) => l[key] === val).length;

    return (
        <div className="flex min-h-screen bg-background">
            <DashboardSidebar />

            <main className="flex-1 overflow-auto">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4">
                    <div className="flex items-center gap-3">
                        <History className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Riwayat Aktivitas</h1>
                            <p className="text-sm text-muted-foreground">
                                Log semua tindakan yang telah dilakukan
                            </p>
                        </div>
                    </div>
                </header>

                <div className="p-6 space-y-5">

                    {/* Summary cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: "Total Aktivitas", value: logs.length, color: "bg-primary/10 text-primary", icon: History },
                            { label: "Upload", value: countBy("action", "upload"), color: "bg-blue-500/10 text-blue-500", icon: Upload },
                            { label: "Scan KK", value: countBy("action", "scan"), color: "bg-purple-500/10 text-purple-500", icon: FileSearch },
                            { label: "Hapus", value: countBy("action", "delete"), color: "bg-red-500/10 text-red-500", icon: Trash2 },
                        ].map((s) => (
                            <div key={s.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${s.color}`}>
                                    <s.icon className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{s.label}</p>
                                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Filter bar */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari aktivitas atau nama dokumen..."
                                className="pl-9"
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            />
                            {search && (
                                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(1); }}>
                            <SelectTrigger className="w-full sm:w-36">
                                <SelectValue placeholder="Aksi" />
                            </SelectTrigger>
                            <SelectContent>
                                {ACTION_OPTIONS.map((o) => (
                                    <SelectItem key={o} value={o}>
                                        {o === "semua" ? "Semua Aksi" : ACTION_CONFIG[o]?.label ?? o}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterEntity} onValueChange={(v) => { setFilterEntity(v); setPage(1); }}>
                            <SelectTrigger className="w-full sm:w-36">
                                <SelectValue placeholder="Entitas" />
                            </SelectTrigger>
                            <SelectContent>
                                {ENTITY_OPTIONS.map((o) => (
                                    <SelectItem key={o} value={o}>
                                        {o === "semua" ? "Semua Jenis" : ENTITY_LABEL[o] ?? o}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {hasFilter && (
                            <Button variant="ghost" size="sm" onClick={resetFilter} className="text-muted-foreground whitespace-nowrap">
                                <X className="h-4 w-4 mr-1" /> Reset
                            </Button>
                        )}
                    </div>

                    {/* Log list */}
                    <div className="glass-card rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 p-5 border-b border-border">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <h2 className="font-semibold text-foreground">Timeline Aktivitas</h2>
                            <span className="ml-auto text-sm text-muted-foreground">
                                {filtered.length} aktivitas
                            </span>
                        </div>

                        {isLoading ? (
                            <div className="p-12 text-center">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-12 text-center">
                                <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="font-medium text-foreground">
                                    {hasFilter ? "Tidak ada aktivitas yang cocok" : "Belum ada aktivitas tercatat"}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {hasFilter
                                        ? "Coba ubah filter pencarian"
                                        : "Aktivitas akan muncul di sini setelah Anda mulai mengelola arsip"}
                                </p>
                                {hasFilter && (
                                    <Button variant="ghost" size="sm" className="mt-3" onClick={resetFilter}>
                                        Reset Filter
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div>
                                {Object.entries(grouped).map(([dateLabel, items]) => (
                                    <div key={dateLabel}>
                                        {/* Date separator */}
                                        <div className="flex items-center gap-3 px-5 py-2.5 bg-muted/30 border-y border-border">
                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                {dateLabel}
                                            </span>
                                            <span className="text-xs text-muted-foreground/60">
                                                {items.length} aktivitas
                                            </span>
                                        </div>

                                        {/* Items */}
                                        <div className="divide-y divide-border">
                                            {items.map((log: any) => {
                                                const cfg = ACTION_CONFIG[log.action] ?? ACTION_CONFIG["login"];
                                                const Icon = cfg.icon;
                                                const time = new Date(log.created_at);
                                                const relTime = formatDistanceToNow(time, { addSuffix: true, locale: localeId });
                                                const absTime = format(time, "HH:mm:ss");

                                                return (
                                                    <div
                                                        key={log.id}
                                                        className="flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors"
                                                    >
                                                        {/* Icon */}
                                                        <div className={cn("p-2 rounded-lg shrink-0 mt-0.5", cfg.color)}>
                                                            <Icon className="h-4 w-4" />
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <Badge variant={cfg.badgeVariant} className="text-[10px] py-0 h-4.5">
                                                                        {cfg.label}
                                                                    </Badge>
                                                                    {log.entity_type && (
                                                                        <Badge variant="outline" className="text-[10px] py-0 h-4.5 text-muted-foreground">
                                                                            {ENTITY_LABEL[log.entity_type] ?? log.entity_type}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="text-xs font-mono text-muted-foreground">{absTime}</p>
                                                                    <p className="text-xs text-muted-foreground/60 mt-0.5">{relTime}</p>
                                                                </div>
                                                            </div>

                                                            {/* Description */}
                                                            <p className="text-sm text-foreground mt-1 leading-snug">
                                                                {log.description}
                                                            </p>

                                                            {/* Entity name */}
                                                            {log.entity_name && (
                                                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                                    📄 {log.entity_name}
                                                                </p>
                                                            )}

                                                            {/* Metadata pills */}
                                                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                                    {Object.entries(log.metadata).map(([k, v]) => (
                                                                        <span
                                                                            key={k}
                                                                            className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-mono"
                                                                        >
                                                                            {k}: {String(v)}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}

                                {/* Load more */}
                                {hasMore && (
                                    <div className="p-4 text-center border-t border-border">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setPage((p) => p + 1)}
                                            className="text-muted-foreground"
                                        >
                                            <ChevronDown className="h-4 w-4 mr-2" />
                                            Tampilkan lebih banyak ({filtered.length - paginated.length} tersisa)
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default RiwayatAktivitas;
