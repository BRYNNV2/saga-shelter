/* eslint-disable @typescript-eslint/no-explicit-any */
import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { useActivityLog } from "@/hooks/useActivityLog";
import { printData } from "@/lib/printUtils";
import {
  Upload,
  FileSearch,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  User as UserIcon,
  Eye,
  FileSpreadsheet,
  Pencil,
  Plus,
  X,
  Save,
  Printer,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";

const BerkasKTP = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { log } = useActivityLog();
  const [uploading, setUploading] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [viewRecord, setViewRecord] = useState<any>(null);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Helper — open edit dialog with a deep copy
  const openEdit = (rec: any) => {
    setEditRecord({ ...rec });
  };

  // Fetch KTP records
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["ktp-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ktp_records")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(records.length / itemsPerPage);
  const currentRecords = records.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Upload handler
  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || !user) return;

      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const ext = file.name.split(".").pop();
          const fileName = `${user.id}/${Date.now()}.${ext}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("documents")
            .getPublicUrl(fileName);

          // Create record
          const { error: insertError } = await supabase
            .from("ktp_records")
            .insert({
              user_id: user.id,
              image_url: urlData.publicUrl,
              status: "pending",
            });

          if (insertError) throw insertError;
        }

        toast({ title: "Berhasil", description: "File KTP berhasil diupload" });
        queryClient.invalidateQueries({ queryKey: ["ktp-records"] });
        log({ action: "upload", entityType: "ktp", description: `Mengupload ${files.length} berkas KTP untuk diproses` });
      } catch (err: any) {
        toast({
          title: "Gagal upload",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [user, toast, queryClient, log]
  );

  // Scan mutation
  const scanMutation = useMutation({
    mutationFn: async (record: any) => {
      setScanningId(record.id);
      const { data, error } = await supabase.functions.invoke("scan-ktp", {
        body: { imageUrl: record.image_url, recordId: record.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Scan berhasil", description: "Data KTP berhasil diekstrak" });
      queryClient.invalidateQueries({ queryKey: ["ktp-records"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      log({ action: "scan", entityType: "ktp", description: `Scan KTP berhasil diekstrak` });
    },
    onError: (err: any) => {
      toast({
        title: "Scan gagal",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => setScanningId(null),
  });

  // Camera capture and auto-scan
  const handleCameraCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || !user) return;
      const file = files[0];
      if (!file) return;

      setUploading(true);
      try {
        const ext = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}_camera.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("documents")
          .getPublicUrl(fileName);

        const { data: newRecord, error: insertError } = await supabase
          .from("ktp_records")
          .insert({
            user_id: user.id,
            image_url: urlData.publicUrl,
            status: "pending",
          })
          .select()
          .single();

        if (insertError) throw insertError;

        toast({ title: "Berhasil foto", description: "Memulai proses OCR langsung..." });
        queryClient.invalidateQueries({ queryKey: ["ktp-records"] });
        log({ action: "upload", entityType: "ktp", description: `Mengambil foto KTP untuk OCR` });

        scanMutation.mutate(newRecord);

      } catch (err: any) {
        toast({
          title: "Gagal memproses",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [user, toast, queryClient, log, scanMutation]
  );

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ktp_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Berhasil dihapus" });
      queryClient.invalidateQueries({ queryKey: ["ktp-records"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      log({ action: "delete", entityType: "ktp", description: "Menghapus berkas KTP" });
    },
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("ktp_records")
        .update({
          nik: data.nik ?? null,
          nama: data.nama ?? null,
          tempat_lahir: data.tempat_lahir ?? null,
          tanggal_lahir: data.tanggal_lahir ?? null,
          jenis_kelamin: data.jenis_kelamin ?? null,
          golongan_darah: data.golongan_darah ?? null,
          alamat: data.alamat ?? null,
          rt_rw: data.rt_rw ?? null,
          kelurahan: data.kelurahan ?? null,
          kecamatan: data.kecamatan ?? null,
          agama: data.agama ?? null,
          status_perkawinan: data.status_perkawinan ?? null,
          pekerjaan: data.pekerjaan ?? null,
          kewarganegaraan: data.kewarganegaraan ?? null,
          status: "scanned",
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Data KTP berhasil diperbarui" });
      queryClient.invalidateQueries({ queryKey: ["ktp-records"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      log({
        action: "edit",
        entityType: "ktp",
        entityId: editRecord?.id,
        entityName: editRecord?.nama ?? editRecord?.nik,
        description: `Mengedit data KTP "${editRecord?.nama ?? editRecord?.nik}" secara manual`,
      });
      setEditRecord(null);
    },
    onError: (err: any) => {
      toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" });
    },
  });

  // Import from Excel
  const handleImportExcel = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;

      setImportingExcel(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: "array" });

        const normalizeRow = (row: any) => {
          const normalized: any = {};
          if (row) {
            Object.keys(row).forEach((key) => {
              normalized[String(key).trim().toLowerCase()] = row[key];
            });
          }
          return normalized;
        };

        const ktpSheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("ktp")) || wb.SheetNames[0];
        const ktpSheet = wb.Sheets[ktpSheetName];
        const ktpRows: any[] = XLSX.utils.sheet_to_json(ktpSheet).map(normalizeRow);

        let imported = 0;
        for (const row of ktpRows) {
          const nik = row["nik"] || row["no ktp"] || row["nomor ktp"] || row["nomor nik"] || "";
          
          const { error: insertError } = await supabase.from("ktp_records").insert({
            user_id: user.id,
            image_url: "",
            nik: String(nik),
            nama: row["nama"] || row["nama lengkap"] || "",
            tempat_lahir: row["tempat lahir"] || row["tempat_lahir"] || "",
            tanggal_lahir: row["tanggal lahir"] || row["tanggal_lahir"] || row["tgl lahir"] || "",
            jenis_kelamin: row["jenis kelamin"] || row["jenis_kelamin"] || row["jk"] || "",
            golongan_darah: row["golongan darah"] || row["gol_darah"] || row["goldar"] || "",
            alamat: row["alamat"] || row["alamat lengkap"] || "",
            rt_rw: row["rt/rw"] || row["rt rw"] || row["rtrw"] || "",
            kelurahan: row["kelurahan"] || row["desa"] || row["kel/desa"] || "",
            kecamatan: row["kecamatan"] || "",
            agama: row["agama"] || "",
            status_perkawinan: row["status perkawinan"] || row["status kawin"] || row["perkawinan"] || "",
            pekerjaan: row["pekerjaan"] || row["profesi"] || "",
            kewarganegaraan: row["kewarganegaraan"] || row["wni/wna"] || row["status kewarganegaraan"] || "",
            status: "scanned",
          });

          if (insertError) throw insertError;
          imported++;
        }

        toast({ title: "Import berhasil", description: `${imported} data KTP berhasil diimport` });
        queryClient.invalidateQueries({ queryKey: ["ktp-records"] });
      } catch (err: any) {
        toast({
          title: "Import gagal",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setImportingExcel(false);
        e.target.value = "";
      }
    },
    [user, toast, queryClient]
  );

  // Export to Excel
  const exportToExcel = () => {
    const scannedRecords = records.filter((r: any) => r.status === "scanned");
    if (scannedRecords.length === 0) {
      toast({ title: "Tidak ada data", description: "Belum ada data yang bisa diekspor", variant: "destructive" });
      return;
    }

    const summaryData = scannedRecords.map((r: any) => ({
      "NIK": r.nik || "-",
      "Nama Lengkap": r.nama || "-",
      "Tempat Lahir": r.tempat_lahir || "-",
      "Tanggal Lahir": r.tanggal_lahir || "-",
      "Jenis Kelamin": r.jenis_kelamin || "-",
      "Golongan Darah": r.golongan_darah || "-",
      "Alamat": r.alamat || "-",
      "RT/RW": r.rt_rw || "-",
      "Kel/Desa": r.kelurahan || "-",
      "Kecamatan": r.kecamatan || "-",
      "Agama": r.agama || "-",
      "Status Perkawinan": r.status_perkawinan || "-",
      "Pekerjaan": r.pekerjaan || "-",
      "Kewarganegaraan": r.kewarganegaraan || "-"
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Data KTP");
    XLSX.writeFile(wb, `Berkas_KTP_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

    toast({ title: "Berhasil", description: "File Excel berhasil diunduh" });
  };

  // Download template Excel
  const downloadTemplate = () => {
    const templateData = [
      {
        "NIK": "3273010101800001",
        "Nama Lengkap": "BUDI SANTOSO",
        "Tempat Lahir": "BANDUNG",
        "Tanggal Lahir": "01-01-1980",
        "Jenis Kelamin": "Laki-laki",
        "Golongan Darah": "O",
        "Alamat": "JL. MERDEKA NO. 10",
        "RT/RW": "001/002",
        "Kelurahan": "SUKAMAJU",
        "Kecamatan": "CIBEUNYING",
        "Agama": "ISLAM",
        "Status Perkawinan": "KAWIN",
        "Pekerjaan": "PEGAWAI SWASTA",
        "Kewarganegaraan": "WNI",
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateData), "Data KTP");
    XLSX.writeFile(wb, "Template_Import_KTP.xlsx");
    toast({ title: "Template berhasil diunduh", description: "Isi template sesuai format, lalu import kembali" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Berkas KTP</h1>
              <p className="text-sm text-muted-foreground">
                Scan dan kelola data Kartu Tanda Penduduk
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  const scanned = records.filter((r: any) => r.status === "scanned");
                  printData({
                    title: "Daftar Berkas KTP",
                    subtitle: `Total: ${scanned.length} KTP sudah discan`,
                    columns: [
                      { header: "#", key: "_no", width: "40px" },
                      { header: "NIK", key: "nik", width: "160px" },
                      { header: "Nama Lengkap", key: "nama", width: "180px" },
                      { header: "Alamat", key: "alamat" },
                      { header: "RT/RW", key: "rt_rw" },
                      { header: "Kecamatan", key: "kecamatan" },
                    ],
                    data: scanned.map((r: any, i: number) => ({
                      ...r,
                      _no: i + 1,
                    })),
                  });
                }}
                disabled={records.filter((r: any) => r.status === "scanned").length === 0}
              >
                <Printer className="h-4 w-4 mr-2" /> Cetak
              </Button>
              <Button variant="outline" onClick={exportToExcel} disabled={records.filter((r: any) => r.status === "scanned").length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>

              <label>
                <Button variant="outline" asChild disabled={importingExcel}>
                  <span>
                    {importingExcel ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                    )}
                    Import Excel
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportExcel}
                  disabled={importingExcel}
                />
              </label>
              <Button variant="outline" onClick={downloadTemplate} title="Download template format Excel yang benar">
                <Download className="h-4 w-4 mr-2" />
                Template
              </Button>
              <label>
                <Button asChild disabled={uploading}>
                  <span>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload KTP
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
              <label>
                <Button asChild disabled={uploading}>
                  <span>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
                    Foto KTP (OCR)
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleCameraCapture}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Berkas</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{records.length}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                  <ImageIcon className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sudah Discan</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {records.filter((r: any) => r.status === "scanned").length}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-success/10 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Menunggu Scan</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {records.filter((r: any) => r.status === "pending").length}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-accent/10 text-accent">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Records list */}
          <div className="glass-card rounded-xl">
            <div className="flex items-center gap-2 p-5 border-b border-border">
              <FileSearch className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Daftar Berkas KTP</h2>
            </div>

            {isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
              </div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Belum ada berkas KTP. Upload gambar KTP untuk mulai.
                </p>
              </div>
            ) : (
              <div>
                <div className="divide-y divide-border">
                  {currentRecords.map((record: any) => (
                  <div
                    key={record.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-muted/50 transition-colors gap-4 sm:gap-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={record.image_url}
                          alt="KTP"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {record.nama || "Belum discan"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {record.nik
                            ? `NIK: ${record.nik}`
                            : format(new Date(record.created_at), "dd MMM yyyy HH:mm", {
                              locale: localeId,
                            })}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end mt-2 sm:mt-0">
                      <Badge
                        variant={record.status === "scanned" ? "default" : "outline"}
                      >
                        {record.status === "scanned" ? "Selesai" : "Pending"}
                      </Badge>

                      {record.status === "scanned" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Lihat detail"
                          onClick={() => setViewRecord(record)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Edit button — semua status */}
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Edit data KTP"
                        onClick={() => openEdit(record)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {record.status === "pending" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => scanMutation.mutate(record)}
                          disabled={scanningId === record.id}
                        >
                          {scanningId === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileSearch className="h-4 w-4" />
                          )}
                          <span className="ml-1">Scan</span>
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(record.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-border gap-4">
                    <p className="text-sm text-muted-foreground">
                      Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, records.length)} dari {records.length} berkas
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Sebelumnya
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Selanjutnya
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Detail Dialog (view only) */}
      <Dialog open={!!viewRecord} onOpenChange={() => setViewRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary" />
              Detail Kartu Tanda Penduduk
            </DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-5">
              {/* Gambar KTP */}
              {viewRecord.image_url && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={viewRecord.image_url} alt="Foto KTP" className="w-full object-contain max-h-64" />
                </div>
              )}

              {/* Field info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {[
                  { label: "NIK", val: viewRecord.nik },
                  { label: "Nama Lengkap", val: viewRecord.nama },
                  { label: "Tempat Lahir", val: viewRecord.tempat_lahir },
                  { label: "Tanggal Lahir", val: viewRecord.tanggal_lahir },
                  { label: "Jenis Kelamin", val: viewRecord.jenis_kelamin },
                  { label: "Golongan Darah", val: viewRecord.golongan_darah },
                  { label: "Alamat", val: viewRecord.alamat },
                  { label: "RT/RW", val: viewRecord.rt_rw },
                  { label: "Kel/Desa", val: viewRecord.kelurahan },
                  { label: "Kecamatan", val: viewRecord.kecamatan },
                  { label: "Agama", val: viewRecord.agama },
                  { label: "Status Perkawinan", val: viewRecord.status_perkawinan },
                  { label: "Pekerjaan", val: viewRecord.pekerjaan },
                  { label: "Kewarganegaraan", val: viewRecord.kewarganegaraan },
                ].map((f) => (
                  <div key={f.label} className="p-3 bg-muted/40 rounded-lg flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground mb-0.5">{f.label}</p>
                    <p className="font-medium text-foreground">{f.val || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setViewRecord(null)}>Tutup</Button>
            {viewRecord && (
              <Button onClick={() => { openEdit(viewRecord); setViewRecord(null); }}>
                <Pencil className="h-4 w-4 mr-2" /> Edit Data
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editRecord} onOpenChange={(o) => { if (!o) setEditRecord(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Data KTP
            </DialogTitle>
          </DialogHeader>

          {editRecord && (
            <div className="space-y-5">
              <div className="glass-card rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-primary" /> Informasi Penduduk
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-nik">NIK</Label>
                    <Input
                      id="edit-nik"
                      value={editRecord.nik ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, nik: e.target.value })}
                      placeholder="16 digit NIK"
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-nama">Nama Lengkap</Label>
                    <Input
                      id="edit-nama"
                      value={editRecord.nama ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, nama: e.target.value })}
                      placeholder="Nama lengkap sesuai KTP"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-tempat">Tempat Lahir</Label>
                    <Input
                      id="edit-tempat"
                      value={editRecord.tempat_lahir ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, tempat_lahir: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-tgl_lahir">Tanggal Lahir</Label>
                    <Input
                      id="edit-tgl_lahir"
                      value={editRecord.tanggal_lahir ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, tanggal_lahir: e.target.value })}
                      placeholder="DD-MM-YYYY"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-jk">Jenis Kelamin</Label>
                    <Input
                      id="edit-jk"
                      value={editRecord.jenis_kelamin ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, jenis_kelamin: e.target.value })}
                      placeholder="Laki-Laki / Perempuan"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-gol">Golongan Darah</Label>
                    <Input
                      id="edit-gol"
                      value={editRecord.golongan_darah ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, golongan_darah: e.target.value })}
                      placeholder="A/B/AB/O/-"
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="edit-alamat">Alamat</Label>
                    <Input
                      id="edit-alamat"
                      value={editRecord.alamat ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, alamat: e.target.value })}
                      placeholder="Jalan, nomor rumah"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-rtrw">RT/RW</Label>
                    <Input
                      id="edit-rtrw"
                      value={editRecord.rt_rw ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, rt_rw: e.target.value })}
                      placeholder="001/002"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-kelurahan">Kel/Desa</Label>
                    <Input
                      id="edit-kelurahan"
                      value={editRecord.kelurahan ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, kelurahan: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-kecamatan">Kecamatan</Label>
                    <Input
                      id="edit-kecamatan"
                      value={editRecord.kecamatan ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, kecamatan: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-agama">Agama</Label>
                    <Input
                      id="edit-agama"
                      value={editRecord.agama ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, agama: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-status_perkawinan">Status Perkawinan</Label>
                    <Input
                      id="edit-status_perkawinan"
                      value={editRecord.status_perkawinan ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, status_perkawinan: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-pekerjaan">Pekerjaan</Label>
                    <Input
                      id="edit-pekerjaan"
                      value={editRecord.pekerjaan ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, pekerjaan: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-kewarganegaraan">Kewarganegaraan</Label>
                    <Input
                      id="edit-kewarganegaraan"
                      value={editRecord.kewarganegaraan ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, kewarganegaraan: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setEditRecord(null)}
              disabled={editMutation.isPending}
            >
              Batal
            </Button>
            <Button
              onClick={async () => {
                setSavingEdit(true);
                try { await editMutation.mutateAsync(editRecord); }
                finally { setSavingEdit(false); }
              }}
              disabled={savingEdit || editMutation.isPending}
            >
              {savingEdit
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Save className="h-4 w-4 mr-2" />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BerkasKTP;
