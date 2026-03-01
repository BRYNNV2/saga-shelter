import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useCategories } from "@/hooks/useCategories";
import { printData } from "@/lib/printUtils";
import {
    FolderOpen,
    Search,
    Plus,
    Eye,
    Trash2,
    Pencil,
    Loader2,
    Archive,
    Filter,
    X,
    FileText,
    Tag,
    Calendar,
    SlidersHorizontal,
    Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// STATUS_OPTIONS & emptyForm unchanged, CATEGORIES now from hook
const STATUS_OPTIONS = ["Aktif", "Review", "Pending", "Arsip"];

const statusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
        case "Aktif": return "default";
        case "Review": return "secondary";
        case "Pending": return "outline";
        case "Arsip": return "destructive";
        default: return "default";
    }
};

const emptyForm = {
    title: "",
    category: "",
    status: "Aktif",
    description: "",
    file_ref: "",
};

const SemuaArsip = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { log } = useActivityLog();
    const { categories: CATEGORIES } = useCategories();

    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [viewRecord, setViewRecord] = useState<any>(null);
    const [editRecord, setEditRecord] = useState<any>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);

    // Fetch all archives
    const { data: archives = [], isLoading } = useQuery({
        queryKey: ["archives-all"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("archives")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    // Filter logic
    const filtered = archives.filter((a: any) => {
        const matchSearch =
            !search ||
            a.title?.toLowerCase().includes(search.toLowerCase()) ||
            a.category?.toLowerCase().includes(search.toLowerCase()) ||
            a.description?.toLowerCase().includes(search.toLowerCase()) ||
            a.file_ref?.toLowerCase().includes(search.toLowerCase());
        const matchCat = filterCategory === "all" || a.category === filterCategory;
        const matchStatus = filterStatus === "all" || a.status === filterStatus;
        return matchSearch && matchCat && matchStatus;
    });

    // Add mutation
    const addMutation = useMutation({
        mutationFn: async (data: typeof emptyForm) => {
            const { error } = await supabase.from("archives").insert({
                title: data.title,
                category: data.category,
                status: data.status,
                description: data.description || null,
                file_ref: data.file_ref || null,
                user_id: user?.id as string,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Berhasil", description: "Arsip berhasil ditambahkan" });
            queryClient.invalidateQueries({ queryKey: ["archives-all"] });
            queryClient.invalidateQueries({ queryKey: ["archives"] });
            queryClient.invalidateQueries({ queryKey: ["archive-stats"] });
            queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
            log({ action: "create", entityType: "arsip", entityName: form.title, description: `Menambahkan arsip baru "${form.title}" (${form.category})` });
            setShowAdd(false);
            setForm({ ...emptyForm });
        },
        onError: (err: any) => {
            toast({ title: "Gagal menambah arsip", description: err.message, variant: "destructive" });
        },
    });

    // Edit mutation
    const editMutation = useMutation({
        mutationFn: async (data: any) => {
            const { error } = await supabase
                .from("archives")
                .update({
                    title: data.title,
                    category: data.category,
                    status: data.status,
                    description: data.description || null,
                    file_ref: data.file_ref || null,
                })
                .eq("id", data.id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Berhasil", description: "Arsip berhasil diperbarui" });
            queryClient.invalidateQueries({ queryKey: ["archives-all"] });
            queryClient.invalidateQueries({ queryKey: ["archives"] });
            queryClient.invalidateQueries({ queryKey: ["archive-stats"] });
            queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
            log({ action: "edit", entityType: "arsip", entityId: editRecord?.id, entityName: editRecord?.title, description: `Mengedit arsip "${editRecord?.title}"` });
            setEditRecord(null);
        },
        onError: (err: any) => {
            toast({ title: "Gagal memperbarui", description: err.message, variant: "destructive" });
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("archives").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Arsip telah dihapus" });
            queryClient.invalidateQueries({ queryKey: ["archives-all"] });
            queryClient.invalidateQueries({ queryKey: ["archives"] });
            queryClient.invalidateQueries({ queryKey: ["archive-stats"] });
            queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
            const deleted = archives.find((a: any) => a.id === deleteId);
            log({ action: "delete", entityType: "arsip", entityId: deleteId ?? undefined, entityName: deleted?.title, description: `Menghapus arsip "${deleted?.title ?? deleteId}"` });
            setDeleteId(null);
        },
        onError: (err: any) => {
            toast({ title: "Gagal menghapus", description: err.message, variant: "destructive" });
        },
    });

    const handleSaveAdd = async () => {
        if (!form.title || !form.category) {
            toast({ title: "Harap isi Judul dan Kategori", variant: "destructive" });
            return;
        }
        setSaving(true);
        try { await addMutation.mutateAsync(form); } finally { setSaving(false); }
    };

    const handleSaveEdit = async () => {
        if (!editRecord.title || !editRecord.category) {
            toast({ title: "Harap isi Judul dan Kategori", variant: "destructive" });
            return;
        }
        setSaving(true);
        try { await editMutation.mutateAsync(editRecord); } finally { setSaving(false); }
    };

    const hasFilter = filterCategory !== "all" || filterStatus !== "all" || search !== "";

    const resetFilters = () => {
        setSearch("");
        setFilterCategory("all");
        setFilterStatus("all");
    };

    return (
        <div className="flex min-h-screen bg-background">
            <DashboardSidebar />

            <main className="flex-1 overflow-auto">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Semua Arsip</h1>
                            <p className="text-sm text-muted-foreground">
                                Kelola seluruh dokumen arsip yang tersimpan
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => printData({
                                    title: "Daftar Semua Arsip",
                                    subtitle: `Total: ${filtered.length} arsip | Filter: ${filterCategory !== 'all' ? filterCategory : 'Semua Kategori'}, ${filterStatus !== 'all' ? filterStatus : 'Semua Status'}`,
                                    columns: [
                                        { header: "#", key: "_no", width: "40px" },
                                        { header: "Judul", key: "title", width: "220px" },
                                        { header: "Kategori", key: "category" },
                                        { header: "Status", key: "status" },
                                        { header: "Deskripsi", key: "description", width: "200px" },
                                        { header: "Ditambahkan", key: "_date" },
                                    ],
                                    data: filtered.map((a: any, i: number) => ({
                                        ...a,
                                        _no: i + 1,
                                        _date: new Date(a.created_at).toLocaleDateString("id-ID"),
                                    })),
                                })}
                            >
                                <Printer className="h-4 w-4 mr-2" /> Cetak
                            </Button>
                            <Button onClick={() => { setForm({ ...emptyForm }); setShowAdd(true); }}>
                                <Plus className="h-4 w-4 mr-2" />
                                Tambah Arsip
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="p-6 space-y-5">
                    {/* Stats bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: "Total Arsip", value: archives.length, colorIcon: "bg-primary/10 text-primary" },
                            { label: "Aktif", value: archives.filter((a: any) => a.status === "Aktif").length, colorIcon: "bg-success/10 text-success" },
                            { label: "Review", value: archives.filter((a: any) => a.status === "Review").length, colorIcon: "bg-accent/10 text-accent" },
                            { label: "Pending", value: archives.filter((a: any) => a.status === "Pending").length, colorIcon: "bg-muted text-muted-foreground" },
                        ].map((s) => (
                            <div key={s.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${s.colorIcon}`}>
                                    <Archive className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{s.label}</p>
                                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Search & Filter */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari arsip berdasarkan judul, kategori, deskripsi..."
                                className="pl-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="w-full sm:w-44">
                                <Filter className="h-4 w-4 mr-2 shrink-0" />
                                <SelectValue placeholder="Kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kategori</SelectItem>
                                {CATEGORIES.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-full sm:w-36">
                                <SlidersHorizontal className="h-4 w-4 mr-2 shrink-0" />
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                {STATUS_OPTIONS.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {hasFilter && (
                            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground whitespace-nowrap">
                                <X className="h-4 w-4 mr-1" /> Reset
                            </Button>
                        )}
                    </div>

                    {/* Table */}
                    <div className="glass-card rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 p-5 border-b border-border">
                            <FolderOpen className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-lg font-semibold text-foreground">Daftar Arsip</h2>
                            <span className="ml-auto text-sm text-muted-foreground">
                                {filtered.length} dari {archives.length} arsip
                            </span>
                        </div>

                        {isLoading ? (
                            <div className="p-12 text-center">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-12 text-center">
                                <Archive className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                                <p className="text-muted-foreground font-medium">
                                    {hasFilter
                                        ? "Tidak ada arsip yang sesuai dengan filter"
                                        : "Belum ada arsip. Klik 'Tambah Arsip' untuk memulai."}
                                </p>
                                {hasFilter && (
                                    <Button variant="ghost" size="sm" className="mt-2" onClick={resetFilters}>
                                        Reset Filter
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-muted/40">
                                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Judul</th>
                                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">Kategori</th>
                                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Ditambahkan</th>
                                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Status</th>
                                            <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {filtered.map((archive: any) => (
                                            <tr key={archive.id} className="hover:bg-muted/30 transition-colors group">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                                                            <FileText className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-foreground line-clamp-1">{archive.title}</p>
                                                            {archive.description && (
                                                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{archive.description}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 hidden md:table-cell">
                                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                                        <Tag className="h-3.5 w-3.5" />
                                                        <span>{archive.category || "—"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 hidden lg:table-cell text-muted-foreground">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        <span>{format(new Date(archive.created_at), "dd MMM yyyy", { locale: localeId })}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <Badge variant={statusVariant(archive.status)}>{archive.status}</Badge>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setViewRecord(archive)}
                                                            title="Lihat detail"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditRecord({ ...archive })}
                                                            title="Edit arsip"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => setDeleteId(archive.id)}
                                                            title="Hapus arsip"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* ── Detail Dialog ── */}
            <Dialog open={!!viewRecord} onOpenChange={() => setViewRecord(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderOpen className="h-5 w-5 text-primary" />
                            Detail Arsip
                        </DialogTitle>
                    </DialogHeader>
                    {viewRecord && (
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                <div className="col-span-2">
                                    <p className="text-xs text-muted-foreground mb-1">Judul</p>
                                    <p className="font-semibold text-foreground text-base">{viewRecord.title}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Kategori</p>
                                    <p className="font-medium">{viewRecord.category || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                                    <Badge variant={statusVariant(viewRecord.status)}>{viewRecord.status}</Badge>
                                </div>
                                {viewRecord.file_ref && (
                                    <div className="col-span-2">
                                        <p className="text-xs text-muted-foreground mb-1">Referensi File</p>
                                        <p className="font-medium break-all">{viewRecord.file_ref}</p>
                                    </div>
                                )}
                                {viewRecord.description && (
                                    <div className="col-span-2">
                                        <p className="text-xs text-muted-foreground mb-1">Deskripsi</p>
                                        <p className="text-foreground whitespace-pre-wrap">{viewRecord.description}</p>
                                    </div>
                                )}
                                <div className="col-span-2 border-t border-border pt-3">
                                    <p className="text-xs text-muted-foreground mb-1">Ditambahkan</p>
                                    <p className="font-medium">
                                        {format(new Date(viewRecord.created_at), "dd MMMM yyyy, HH:mm", { locale: localeId })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Tutup</Button>
                        </DialogClose>
                        {viewRecord && (
                            <Button
                                onClick={() => {
                                    setEditRecord({ ...viewRecord });
                                    setViewRecord(null);
                                }}
                            >
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Add Dialog ── */}
            <Dialog
                open={showAdd}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowAdd(false);
                        setForm({ ...emptyForm });
                    }
                }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" />
                            Tambah Arsip Baru
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <Label htmlFor="add-title">
                                    Judul Arsip <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="add-title"
                                    placeholder="Masukkan judul arsip"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>
                                    Kategori <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={form.category}
                                    onValueChange={(v) => setForm({ ...form, category: v })}
                                >
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Pilih kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map((c) => (
                                            <SelectItem key={c} value={c}>
                                                {c}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Status</Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(v) => setForm({ ...form, status: v })}
                                >
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2">
                                <Label htmlFor="add-fileref">Referensi File</Label>
                                <Input
                                    id="add-fileref"
                                    placeholder="Contoh: /dokumen/surat-2024.pdf"
                                    value={form.file_ref}
                                    onChange={(e) => setForm({ ...form, file_ref: e.target.value })}
                                    className="mt-1"
                                />
                            </div>
                            <div className="col-span-2">
                                <Label htmlFor="add-desc">Deskripsi</Label>
                                <Textarea
                                    id="add-desc"
                                    placeholder="Keterangan tambahan tentang arsip ini..."
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="mt-1 resize-none"
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-2">
                        <DialogClose asChild>
                            <Button variant="outline" disabled={saving}>
                                Batal
                            </Button>
                        </DialogClose>
                        <Button onClick={handleSaveAdd} disabled={saving}>
                            {saving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4 mr-2" />
                            )}
                            Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Edit Dialog ── */}
            <Dialog open={!!editRecord} onOpenChange={(open) => { if (!open) setEditRecord(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-5 w-5 text-primary" />
                            Edit Arsip
                        </DialogTitle>
                    </DialogHeader>
                    {editRecord && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <Label>
                                        Judul Arsip <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        placeholder="Judul arsip"
                                        value={editRecord.title}
                                        onChange={(e) => setEditRecord({ ...editRecord, title: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>
                                        Kategori <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                        value={editRecord.category}
                                        onValueChange={(v) => setEditRecord({ ...editRecord, category: v })}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Pilih kategori" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CATEGORIES.map((c) => (
                                                <SelectItem key={c} value={c}>
                                                    {c}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Status</Label>
                                    <Select
                                        value={editRecord.status}
                                        onValueChange={(v) => setEditRecord({ ...editRecord, status: v })}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STATUS_OPTIONS.map((s) => (
                                                <SelectItem key={s} value={s}>
                                                    {s}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2">
                                    <Label>Referensi File</Label>
                                    <Input
                                        placeholder="Referensi file"
                                        value={editRecord.file_ref || ""}
                                        onChange={(e) => setEditRecord({ ...editRecord, file_ref: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Label>Deskripsi</Label>
                                    <Textarea
                                        placeholder="Keterangan tambahan..."
                                        value={editRecord.description || ""}
                                        onChange={(e) =>
                                            setEditRecord({ ...editRecord, description: e.target.value })
                                        }
                                        className="mt-1 resize-none"
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="mt-2">
                        <DialogClose asChild>
                            <Button variant="outline" disabled={saving}>
                                Batal
                            </Button>
                        </DialogClose>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Pencil className="h-4 w-4 mr-2" />
                            )}
                            Simpan Perubahan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirmation ── */}
            <AlertDialog
                open={!!deleteId}
                onOpenChange={(open) => { if (!open) setDeleteId(null); }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Arsip?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Arsip akan dihapus secara permanen dari sistem.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                        >
                            {deleteMutation.isPending && (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            )}
                            Hapus Sekarang
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default SemuaArsip;
