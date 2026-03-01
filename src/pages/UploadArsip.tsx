import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";
import { useActivityLog } from "@/hooks/useActivityLog";
import {
    Upload,
    FileText,
    FileImage,
    FileSpreadsheet,
    File,
    X,
    CheckCircle2,
    AlertCircle,
    Loader2,
    CloudUpload,
    FolderOpen,
    Trash2,
    Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const CATEGORIES = [
    "Administrasi",
    "Keuangan",
    "Kepegawaian",
    "Hukum",
    "Teknis",
    "Surat Masuk",
    "Surat Keluar",
    "Lainnya",
];

const STATUS_OPTIONS = ["Aktif", "Review", "Pending"];

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface FileItem {
    id: string;
    file: File;
    title: string;
    category: string;
    status: string;
    description: string;
    preview?: string;
    uploadStatus: UploadStatus;
    progress: number;
    errorMsg?: string;
    publicUrl?: string;
}

const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith("image/")) return FileImage;
    if (type.includes("spreadsheet") || type.includes("excel") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv"))
        return FileSpreadsheet;
    if (type.includes("pdf") || type.includes("text") || type.includes("word"))
        return FileText;
    return File;
};

const getFileColor = (file: File) => {
    const type = file.type;
    if (type.startsWith("image/")) return "text-blue-500 bg-blue-500/10";
    if (type.includes("spreadsheet") || type.includes("excel") || file.name.endsWith(".xlsx"))
        return "text-green-500 bg-green-500/10";
    if (type.includes("pdf")) return "text-red-500 bg-red-500/10";
    return "text-primary bg-primary/10";
};

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const generateId = () => Math.random().toString(36).slice(2, 10);

const UploadArsip = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { log } = useActivityLog();
    const dropRef = useRef<HTMLDivElement>(null);

    const [fileItems, setFileItems] = useState<FileItem[]>([]);
    const [dragging, setDragging] = useState(false);
    const [uploadingAll, setUploadingAll] = useState(false);

    // Add files to queue
    const addFiles = useCallback((files: FileList | File[]) => {
        const newItems: FileItem[] = Array.from(files).map((file) => {
            const preview = file.type.startsWith("image/")
                ? URL.createObjectURL(file)
                : undefined;
            // Auto-detect title from filename (strip extension)
            const title = file.name.replace(/\.[^/.]+$/, "");
            return {
                id: generateId(),
                file,
                title,
                category: "",
                status: "Aktif",
                description: "",
                preview,
                uploadStatus: "idle",
                progress: 0,
            };
        });
        setFileItems((prev) => [...prev, ...newItems]);
    }, []);

    // Drag events
    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        if (!dropRef.current?.contains(e.relatedTarget as Node)) setDragging(false);
    }, []);

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        },
        [addFiles]
    );

    const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) addFiles(e.target.files);
        e.target.value = "";
    };

    // Update single item field
    const updateItem = (id: string, patch: Partial<FileItem>) =>
        setFileItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
        );

    // Remove item
    const removeItem = (id: string) => {
        setFileItems((prev) => {
            const item = prev.find((i) => i.id === id);
            if (item?.preview) URL.revokeObjectURL(item.preview);
            return prev.filter((i) => i.id !== id);
        });
    };

    // Upload single file
    const uploadFile = async (item: FileItem) => {
        if (!user) return;
        if (!item.title || !item.category) {
            updateItem(item.id, {
                uploadStatus: "error",
                errorMsg: "Judul dan Kategori wajib diisi",
            });
            return;
        }

        updateItem(item.id, { uploadStatus: "uploading", progress: 10 });

        try {
            const ext = item.file.name.split(".").pop();
            const storagePath = `${user.id}/${Date.now()}_${generateId()}.${ext}`;

            // Upload to Supabase Storage
            const { error: storageError } = await supabase.storage
                .from("documents")
                .upload(storagePath, item.file, { upsert: false });

            if (storageError) throw storageError;

            updateItem(item.id, { progress: 60 });

            // Get public URL
            const { data: urlData } = supabase.storage
                .from("documents")
                .getPublicUrl(storagePath);

            updateItem(item.id, { progress: 80 });

            // Insert archive record
            const { error: insertError } = await supabase.from("archives").insert({
                user_id: user.id,
                title: item.title,
                category: item.category,
                status: item.status,
                description: item.description || null,
                file_ref: urlData.publicUrl,
            });

            if (insertError) throw insertError;

            updateItem(item.id, {
                uploadStatus: "success",
                progress: 100,
                publicUrl: urlData.publicUrl,
            });
            log({
                action: "upload",
                entityType: "arsip",
                entityName: item.title,
                description: `Mengupload file "${item.file.name}" sebagai arsip "${item.title}" (${item.category})`,
                metadata: { ukuran: `${(item.file.size / 1024).toFixed(1)} KB`, kategori: item.category },
            });
        } catch (err: any) {
            updateItem(item.id, {
                uploadStatus: "error",
                progress: 0,
                errorMsg: err.message,
            });
        }
    };

    // Upload all pending
    const handleUploadAll = async () => {
        const pendingItems = fileItems.filter(
            (i) => i.uploadStatus === "idle" || i.uploadStatus === "error"
        );
        if (pendingItems.length === 0) {
            toast({ title: "Tidak ada file untuk diupload" });
            return;
        }

        const missingMeta = pendingItems.filter((i) => !i.title || !i.category);
        if (missingMeta.length > 0) {
            toast({
                title: `${missingMeta.length} file belum lengkap`,
                description: "Harap isi Judul dan Kategori untuk semua file",
                variant: "destructive",
            });
            return;
        }

        setUploadingAll(true);
        await Promise.all(pendingItems.map((item) => uploadFile(item)));
        setUploadingAll(false);

        queryClient.invalidateQueries({ queryKey: ["archives-all"] });
        queryClient.invalidateQueries({ queryKey: ["archives"] });
        queryClient.invalidateQueries({ queryKey: ["archive-stats"] });

        const successCount = fileItems.filter((i) => i.uploadStatus === "success").length +
            pendingItems.filter((i) => i.uploadStatus !== "error").length;

        toast({
            title: "Upload selesai",
            description: `${pendingItems.length} file berhasil diupload ke arsip`,
        });
    };

    // Clear completed
    const clearCompleted = () => {
        setFileItems((prev) => {
            prev.filter((i) => i.uploadStatus === "success").forEach((i) => {
                if (i.preview) URL.revokeObjectURL(i.preview);
            });
            return prev.filter((i) => i.uploadStatus !== "success");
        });
    };

    const pendingCount = fileItems.filter(
        (i) => i.uploadStatus === "idle" || i.uploadStatus === "error"
    ).length;
    const successCount = fileItems.filter((i) => i.uploadStatus === "success").length;
    const uploadingCount = fileItems.filter((i) => i.uploadStatus === "uploading").length;

    return (
        <div className="flex min-h-screen bg-background">
            <DashboardSidebar />

            <main className="flex-1 overflow-auto">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Upload Arsip</h1>
                            <p className="text-sm text-muted-foreground">
                                Unggah dokumen arsip ke sistem penyimpanan
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {successCount > 0 && (
                                <Button variant="outline" onClick={clearCompleted}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Bersihkan Selesai ({successCount})
                                </Button>
                            )}
                            {pendingCount > 0 && (
                                <Button onClick={handleUploadAll} disabled={uploadingAll}>
                                    {uploadingAll ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <CloudUpload className="h-4 w-4 mr-2" />
                                    )}
                                    Upload Semua ({pendingCount})
                                </Button>
                            )}
                        </div>
                    </div>
                </header>

                <div className="p-6 space-y-6">
                    {/* Stats mini */}
                    {fileItems.length > 0 && (
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                {
                                    label: "Antrian",
                                    value: pendingCount,
                                    color: "bg-accent/10 text-accent",
                                },
                                {
                                    label: "Sedang Upload",
                                    value: uploadingCount,
                                    color: "bg-primary/10 text-primary",
                                },
                                {
                                    label: "Berhasil",
                                    value: successCount,
                                    color: "bg-success/10 text-success",
                                },
                            ].map((s) => (
                                <div key={s.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${s.color}`}>
                                        <Upload className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">{s.label}</p>
                                        <p className="text-xl font-bold text-foreground">{s.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Drop Zone */}
                    <div
                        ref={dropRef}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        className={cn(
                            "relative border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer",
                            dragging
                                ? "border-primary bg-primary/5 scale-[1.01]"
                                : "border-border hover:border-primary/50 hover:bg-muted/30"
                        )}
                    >
                        <label className="flex flex-col items-center justify-center py-14 px-6 cursor-pointer select-none">
                            <div
                                className={cn(
                                    "p-5 rounded-full mb-5 transition-all duration-200",
                                    dragging ? "bg-primary/20 scale-110" : "bg-muted"
                                )}
                            >
                                <CloudUpload
                                    className={cn(
                                        "h-10 w-10 transition-colors",
                                        dragging ? "text-primary" : "text-muted-foreground"
                                    )}
                                />
                            </div>
                            <p className="text-lg font-semibold text-foreground mb-1">
                                {dragging ? "Lepaskan file di sini" : "Tarik & Lepas file di sini"}
                            </p>
                            <p className="text-sm text-muted-foreground mb-4">
                                atau klik untuk memilih file dari komputer
                            </p>
                            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                                {["PDF", "Word", "Excel", "Gambar", "CSV", "TXT"].map((ext) => (
                                    <span key={ext} className="px-2 py-1 rounded-md bg-muted font-mono">
                                        {ext}
                                    </span>
                                ))}
                            </div>
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
                                className="hidden"
                                onChange={onFileInput}
                            />
                        </label>
                    </div>

                    {/* File Queue */}
                    {fileItems.length > 0 && (
                        <div className="glass-card rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 p-5 border-b border-border">
                                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                                <h2 className="text-lg font-semibold text-foreground">
                                    Antrian Upload
                                </h2>
                                <span className="ml-auto text-sm text-muted-foreground">
                                    {fileItems.length} file
                                </span>
                            </div>

                            <div className="divide-y divide-border">
                                {fileItems.map((item) => {
                                    const Icon = getFileIcon(item.file);
                                    const iconColor = getFileColor(item.file);

                                    return (
                                        <div key={item.id} className="p-5">
                                            <div className="flex gap-4">
                                                {/* File Icon or Preview */}
                                                <div className="shrink-0">
                                                    {item.preview ? (
                                                        <div className="h-16 w-16 rounded-lg overflow-hidden border border-border">
                                                            <img
                                                                src={item.preview}
                                                                alt={item.file.name}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className={cn("h-16 w-16 rounded-lg flex items-center justify-center", iconColor)}>
                                                            <Icon className="h-7 w-7" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* File info + form */}
                                                <div className="flex-1 min-w-0 space-y-3">
                                                    {/* Filename & status row */}
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-foreground truncate">
                                                                {item.file.name}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {formatFileSize(item.file.size)}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {item.uploadStatus === "idle" && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    Siap Upload
                                                                </Badge>
                                                            )}
                                                            {item.uploadStatus === "uploading" && (
                                                                <Badge variant="secondary" className="text-xs gap-1">
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                    Mengupload
                                                                </Badge>
                                                            )}
                                                            {item.uploadStatus === "success" && (
                                                                <Badge className="text-xs gap-1 bg-success text-success-foreground">
                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                    Berhasil
                                                                </Badge>
                                                            )}
                                                            {item.uploadStatus === "error" && (
                                                                <Badge variant="destructive" className="text-xs gap-1">
                                                                    <AlertCircle className="h-3 w-3" />
                                                                    Gagal
                                                                </Badge>
                                                            )}

                                                            {/* Actions */}
                                                            {item.uploadStatus === "success" && item.publicUrl && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    asChild
                                                                    title="Buka file"
                                                                >
                                                                    <a href={item.publicUrl} target="_blank" rel="noreferrer">
                                                                        <Eye className="h-4 w-4" />
                                                                    </a>
                                                                </Button>
                                                            )}
                                                            {item.uploadStatus !== "uploading" && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-destructive hover:text-destructive"
                                                                    onClick={() => removeItem(item.id)}
                                                                    title="Hapus dari antrian"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Progress bar */}
                                                    {item.uploadStatus === "uploading" && (
                                                        <Progress value={item.progress} className="h-1.5" />
                                                    )}

                                                    {/* Error */}
                                                    {item.uploadStatus === "error" && item.errorMsg && (
                                                        <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-1.5">
                                                            ⚠️ {item.errorMsg}
                                                        </p>
                                                    )}

                                                    {/* Metadata form — hide when success */}
                                                    {item.uploadStatus !== "success" && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                            <div className="sm:col-span-1">
                                                                <Label className="text-xs mb-1 block">
                                                                    Judul <span className="text-destructive">*</span>
                                                                </Label>
                                                                <Input
                                                                    placeholder="Judul dokumen"
                                                                    value={item.title}
                                                                    onChange={(e) =>
                                                                        updateItem(item.id, { title: e.target.value })
                                                                    }
                                                                    disabled={item.uploadStatus === "uploading"}
                                                                    className="h-8 text-sm"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-xs mb-1 block">
                                                                    Kategori <span className="text-destructive">*</span>
                                                                </Label>
                                                                <Select
                                                                    value={item.category}
                                                                    onValueChange={(v) =>
                                                                        updateItem(item.id, { category: v })
                                                                    }
                                                                    disabled={item.uploadStatus === "uploading"}
                                                                >
                                                                    <SelectTrigger className="h-8 text-sm">
                                                                        <SelectValue placeholder="Pilih..." />
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
                                                                <Label className="text-xs mb-1 block">Status</Label>
                                                                <Select
                                                                    value={item.status}
                                                                    onValueChange={(v) =>
                                                                        updateItem(item.id, { status: v })
                                                                    }
                                                                    disabled={item.uploadStatus === "uploading"}
                                                                >
                                                                    <SelectTrigger className="h-8 text-sm">
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
                                                            <div className="sm:col-span-3">
                                                                <Label className="text-xs mb-1 block">
                                                                    Deskripsi (opsional)
                                                                </Label>
                                                                <Textarea
                                                                    placeholder="Keterangan singkat tentang dokumen ini..."
                                                                    value={item.description}
                                                                    onChange={(e) =>
                                                                        updateItem(item.id, {
                                                                            description: e.target.value,
                                                                        })
                                                                    }
                                                                    disabled={item.uploadStatus === "uploading"}
                                                                    className="text-sm resize-none h-16"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Success info */}
                                                    {item.uploadStatus === "success" && (
                                                        <p className="text-xs text-success">
                                                            ✓ File berhasil diupload dan disimpan ke arsip
                                                            {item.publicUrl && " · "}
                                                            {item.publicUrl && (
                                                                <a
                                                                    href={item.publicUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="underline hover:no-underline"
                                                                >
                                                                    Buka file
                                                                </a>
                                                            )}
                                                        </p>
                                                    )}

                                                    {/* Upload single button */}
                                                    {(item.uploadStatus === "idle" ||
                                                        item.uploadStatus === "error") && (
                                                            <div className="flex justify-end">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => uploadFile(item)}
                                                                    disabled={uploadingAll}
                                                                >
                                                                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                                                                    Upload File Ini
                                                                </Button>
                                                            </div>
                                                        )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {fileItems.length === 0 && (
                        <div className="glass-card rounded-xl p-10 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-4 rounded-full bg-muted">
                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="font-medium text-foreground">Belum ada file dipilih</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Tarik & lepas file atau klik zona upload di atas untuk memilih file.
                                    </p>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                                    <p>💡 Anda bisa upload banyak file sekaligus</p>
                                    <p>💡 Isi metadata (judul, kategori) sebelum upload</p>
                                    <p>💡 File akan otomatis tersimpan di halaman Semua Arsip</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default UploadArsip;
