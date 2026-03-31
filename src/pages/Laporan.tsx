/* eslint-disable @typescript-eslint/no-explicit-any */
import DashboardSidebar from "@/components/DashboardSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import {
    BarChart2,
    Archive,
    FileText,
    Users,
    TrendingUp,
    TrendingDown,
    Minus,
    Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isSameMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

// ─── Colour palette ───
const PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#3b82f6"];

const STATUS_COLORS: Record<string, string> = {
    Aktif: "#6366f1",
    Review: "#f59e0b",
    Pending: "#94a3b8",
    Arsip: "#ec4899",
};

const KK_STATUS_COLORS: Record<string, string> = {
    scanned: "#22c55e",
    pending: "#f59e0b",
};

// ─── Helpers ───
const last12Months = () =>
    Array.from({ length: 12 }, (_, i) => subMonths(new Date(), 11 - i));

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-popover border border-border rounded-lg shadow-lg px-4 py-2.5 text-sm">
            <p className="font-semibold text-foreground mb-1">{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} style={{ color: p.color }} className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                    {p.name}: <span className="font-bold ml-1">{p.value}</span>
                </p>
            ))}
        </div>
    );
};

// Pie custom label
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

// ─── Main Component ───
const Laporan = () => {
    const { toast } = useToast();
    const [rangeMonths, setRangeMonths] = useState("12");

    // ── Fetch data ──
    const { data: archives = [], isLoading: loadingArsip } = useQuery({
        queryKey: ["laporan-archives"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("archives")
                .select("id, category, status, created_at")
                .order("created_at", { ascending: true });
            if (error) throw error;
            return data;
        },
    });

    const { data: kkRecords = [], isLoading: loadingKK } = useQuery({
        queryKey: ["laporan-kk"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("kk_records")
                .select("id, status, created_at")
                .order("created_at", { ascending: true });
            if (error) throw error;
            return data;
        },
    });

    const months = useMemo(() => last12Months().slice(-Number(rangeMonths)), [rangeMonths]);

    // ── Tren bulanan arsip ──
    const trendData = useMemo(() =>
        months.map((m) => {
            const label = format(m, "MMM yy", { locale: localeId });
            const count = archives.filter((a) => isSameMonth(parseISO(a.created_at), m)).length;
            const kkCount = kkRecords.filter((k) => isSameMonth(parseISO(k.created_at), m)).length;
            return { bulan: label, Arsip: count, "Berkas KK": kkCount };
        }), [months, archives, kkRecords]);

    // ── Distribusi per kategori ──
    const categoryData = useMemo(() => {
        const map: Record<string, number> = {};
        archives.forEach((a) => {
            const cat = a.category || "Lainnya";
            map[cat] = (map[cat] || 0) + 1;
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [archives]);

    // ── Status arsip ──
    const statusData = useMemo(() => {
        const map: Record<string, number> = {};
        archives.forEach((a) => { map[a.status] = (map[a.status] || 0) + 1; });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [archives]);

    // ── Status KK pie ──
    const kkStatusData = useMemo(() => {
        const scanned = kkRecords.filter((k) => k.status === "scanned").length;
        const pending = kkRecords.filter((k) => k.status === "pending").length;
        return [
            { name: "Sudah Discan", value: scanned },
            { name: "Belum Discan", value: pending },
        ].filter((d) => d.value > 0);
    }, [kkRecords]);

    // ── Bar chart bulanan KK ──
    const kkMonthlyBar = useMemo(() =>
        months.map((m) => ({
            bulan: format(m, "MMM yy", { locale: localeId }),
            Discan: kkRecords.filter((k) => k.status === "scanned" && isSameMonth(parseISO(k.created_at), m)).length,
            Pending: kkRecords.filter((k) => k.status === "pending" && isSameMonth(parseISO(k.created_at), m)).length,
        })), [months, kkRecords]);

    // ── Summary stats ──
    const prevMonth = subMonths(new Date(), 1);
    const thisMonth = new Date();
    const arsipThisMonth = archives.filter((a) => isSameMonth(parseISO(a.created_at), thisMonth)).length;
    const arsipLastMonth = archives.filter((a) => isSameMonth(parseISO(a.created_at), prevMonth)).length;
    const kkThisMonth = kkRecords.filter((k) => isSameMonth(parseISO(k.created_at), thisMonth)).length;
    const kkLastMonth = kkRecords.filter((k) => isSameMonth(parseISO(k.created_at), prevMonth)).length;

    const trend = (curr: number, prev: number) => {
        if (prev === 0 && curr === 0) return { icon: Minus, text: "Sama", color: "text-muted-foreground" };
        if (prev === 0) return { icon: TrendingUp, text: `+${curr}`, color: "text-success" };
        const diff = curr - prev;
        const pct = Math.round((diff / prev) * 100);
        if (diff > 0) return { icon: TrendingUp, text: `+${pct}%`, color: "text-success" };
        if (diff < 0) return { icon: TrendingDown, text: `${pct}%`, color: "text-destructive" };
        return { icon: Minus, text: "0%", color: "text-muted-foreground" };
    };

    const arsipTrend = trend(arsipThisMonth, arsipLastMonth);
    const kkTrend = trend(kkThisMonth, kkLastMonth);

    // ── Export laporan ──
    const handleExport = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Tren bulanan
        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(trendData.map((r) => ({
                Bulan: r.bulan,
                "Jumlah Arsip": r.Arsip,
                "Berkas KK": r["Berkas KK"],
            }))),
            "Tren Bulanan"
        );

        // Sheet 2: Kategori
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categoryData), "Per Kategori");

        // Sheet 3: Status arsip
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statusData), "Status Arsip");

        XLSX.writeFile(wb, `Laporan_ArsipKu_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
        toast({ title: "Laporan berhasil diunduh", description: "File Excel tersimpan di folder unduhan Anda" });
    };

    const loading = loadingArsip || loadingKK;

    return (
        <div className="flex min-h-screen bg-background">
            <DashboardSidebar />

            <main className="flex-1 overflow-auto">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
                        <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                            <BarChart2 className="h-6 w-6 text-muted-foreground" />
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">Laporan & Statistik</h1>
                                <p className="text-sm text-muted-foreground">Visualisasi data arsip dan berkas KK</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                            <Select value={rangeMonths} onValueChange={setRangeMonths}>
                                <SelectTrigger className="w-36">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="3">3 Bulan</SelectItem>
                                    <SelectItem value="6">6 Bulan</SelectItem>
                                    <SelectItem value="12">12 Bulan</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={handleExport} variant="outline">
                                <Download className="h-4 w-4 mr-2" /> Export Excel
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="p-6 space-y-6">

                    {/* ── Summary Cards ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            {
                                label: "Total Arsip",
                                value: archives.length,
                                sub: `${arsipThisMonth} bulan ini`,
                                icon: Archive,
                                color: "bg-primary/10 text-primary",
                                trend: arsipTrend,
                            },
                            {
                                label: "Total Berkas KK",
                                value: kkRecords.length,
                                sub: `${kkThisMonth} bulan ini`,
                                icon: FileText,
                                color: "bg-accent/10 text-accent",
                                trend: kkTrend,
                            },
                            {
                                label: "KK Sudah Discan",
                                value: kkRecords.filter((k) => k.status === "scanned").length,
                                sub: `${kkRecords.length > 0 ? Math.round((kkRecords.filter((k) => k.status === "scanned").length / kkRecords.length) * 100) : 0}% dari total`,
                                icon: Users,
                                color: "bg-success/10 text-success",
                                trend: null,
                            },
                            {
                                label: "Kategori Aktif",
                                value: new Set(archives.map((a) => a.category)).size,
                                sub: "jenis kategori",
                                icon: BarChart2,
                                color: "bg-orange-500/10 text-orange-500",
                                trend: null,
                            },
                        ].map((card) => (
                            <div key={card.label} className="glass-card rounded-xl p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className={`p-2.5 rounded-lg ${card.color}`}>
                                        <card.icon className="h-5 w-5" />
                                    </div>
                                    {card.trend && (
                                        <span className={`text-xs font-semibold flex items-center gap-0.5 ${card.trend.color}`}>
                                            <card.trend.icon className="h-3.5 w-3.5" />
                                            {card.trend.text}
                                        </span>
                                    )}
                                </div>
                                <p className="text-2xl font-bold text-foreground">{loading ? "—" : card.value}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                                <p className="text-xs text-muted-foreground/70 mt-0.5">{card.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Tren Arsip + KK per bulan (Area) ── */}
                    <div className="glass-card rounded-xl p-5">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="font-semibold text-foreground">Tren Penambahan per Bulan</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Jumlah arsip dan berkas KK yang ditambahkan</p>
                            </div>
                            <Badge variant="outline">{rangeMonths} bulan terakhir</Badge>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={trendData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gradArsip" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradKK" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                                <Area type="monotone" dataKey="Arsip" stroke="#6366f1" strokeWidth={2} fill="url(#gradArsip)" dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
                                <Area type="monotone" dataKey="Berkas KK" stroke="#22c55e" strokeWidth={2} fill="url(#gradKK)" dot={{ r: 3, fill: "#22c55e" }} activeDot={{ r: 5 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ── Kategori + Status (2 kolom) ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Distribusi Kategori (Bar) */}
                        <div className="glass-card rounded-xl p-5">
                            <div className="mb-5">
                                <h2 className="font-semibold text-foreground">Arsip per Kategori</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Distribusi berdasarkan kategori dokumen</p>
                            </div>
                            {categoryData.length === 0 ? (
                                <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                                    Belum ada data kategori
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={80} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="value" name="Jumlah" radius={[0, 6, 6, 0]}>
                                            {categoryData.map((_, i) => (
                                                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Status Arsip (Pie) */}
                        <div className="glass-card rounded-xl p-5">
                            <div className="mb-5">
                                <h2 className="font-semibold text-foreground">Status Arsip</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Proporsi status dokumen yang tersimpan</p>
                            </div>
                            {statusData.length === 0 ? (
                                <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                                    Belum ada data
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <ResponsiveContainer width="55%" height={200}>
                                        <PieChart>
                                            <Pie
                                                data={statusData}
                                                cx="50%" cy="50%"
                                                innerRadius={45} outerRadius={80}
                                                dataKey="value"
                                                labelLine={false}
                                                label={renderPieLabel}
                                            >
                                                {statusData.map((entry, i) => (
                                                    <Cell key={i} fill={STATUS_COLORS[entry.name] || PALETTE[i % PALETTE.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    {/* Legend manual */}
                                    <div className="flex-1 space-y-2.5">
                                        {statusData.map((entry, i) => (
                                            <div key={entry.name} className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="inline-block h-2.5 w-2.5 rounded-full"
                                                        style={{ background: STATUS_COLORS[entry.name] || PALETTE[i % PALETTE.length] }}
                                                    />
                                                    <span className="text-muted-foreground">{entry.name}</span>
                                                </div>
                                                <span className="font-bold text-foreground">{entry.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Berkas KK monthly bar + KK status pie ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* KK per bulan (stacked bar) */}
                        <div className="glass-card rounded-xl p-5">
                            <div className="mb-5">
                                <h2 className="font-semibold text-foreground">Perkembangan Berkas KK</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Discan vs Belum Discan per bulan</p>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={kkMonthlyBar} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                                    <Bar dataKey="Discan" fill={KK_STATUS_COLORS.scanned} radius={[4, 4, 0, 0]} stackId="a" />
                                    <Bar dataKey="Pending" fill={KK_STATUS_COLORS.pending} radius={[4, 4, 0, 0]} stackId="a" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* KK Status pie */}
                        <div className="glass-card rounded-xl p-5">
                            <div className="mb-5">
                                <h2 className="font-semibold text-foreground">Status Berkas KK</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Perbandingan KK yang sudah & belum discan</p>
                            </div>
                            {kkStatusData.length === 0 ? (
                                <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                                    Belum ada data KK
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <ResponsiveContainer width="55%" height={200}>
                                        <PieChart>
                                            <Pie
                                                data={kkStatusData}
                                                cx="50%" cy="50%"
                                                innerRadius={45} outerRadius={80}
                                                dataKey="value"
                                                labelLine={false}
                                                label={renderPieLabel}
                                            >
                                                <Cell fill={KK_STATUS_COLORS.scanned} />
                                                <Cell fill={KK_STATUS_COLORS.pending} />
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex-1 space-y-3">
                                        {kkStatusData.map((entry, i) => {
                                            const color = i === 0 ? KK_STATUS_COLORS.scanned : KK_STATUS_COLORS.pending;
                                            const pct = kkRecords.length > 0
                                                ? Math.round((entry.value / kkRecords.length) * 100)
                                                : 0;
                                            return (
                                                <div key={entry.name}>
                                                    <div className="flex items-center justify-between text-sm mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                                                            <span className="text-muted-foreground">{entry.name}</span>
                                                        </div>
                                                        <span className="font-bold text-foreground">{entry.value}</span>
                                                    </div>
                                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5 text-right">{pct}%</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Tabel ringkasan kategori ── */}
                    <div className="glass-card rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 p-5 border-b border-border">
                            <BarChart2 className="h-5 w-5 text-muted-foreground" />
                            <h2 className="font-semibold text-foreground">Ringkasan per Kategori</h2>
                        </div>
                        {categoryData.length === 0 ? (
                            <div className="p-10 text-center text-muted-foreground text-sm">Belum ada data arsip</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-muted/40">
                                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Kategori</th>
                                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Jumlah</th>
                                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Proporsi</th>
                                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">Visualisasi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {categoryData.map((cat, i) => {
                                            const pct = archives.length > 0 ? Math.round((cat.value / archives.length) * 100) : 0;
                                            return (
                                                <tr key={cat.name} className="hover:bg-muted/30 transition-colors">
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                                                            <span className="font-medium text-foreground">{cat.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3.5 font-bold text-foreground">{cat.value}</td>
                                                    <td className="px-5 py-3.5 text-muted-foreground">{pct}%</td>
                                                    <td className="px-5 py-3.5 hidden md:table-cell">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-2 bg-muted rounded-full flex-1 max-w-32 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full"
                                                                    style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </div>
            </main>
        </div>
    );
};

export default Laporan;
