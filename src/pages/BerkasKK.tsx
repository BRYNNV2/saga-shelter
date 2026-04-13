/* eslint-disable @typescript-eslint/no-explicit-any */
import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
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
  Users,
  Eye,
  FileSpreadsheet,
  Pencil,
  Plus,
  X,
  Save,
  UserPlus,
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

const BerkasKK = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { log } = useActivityLog();
  const [uploading, setUploading] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [viewRecord, setViewRecord] = useState<any>(null);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Cooldown effect
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  // Helper — open edit dialog with a deep copy
  const openEdit = (rec: any) => {
    setEditRecord({
      ...rec,
      anggota: Array.isArray(rec.anggota)
        ? rec.anggota.map((a: any) => ({ ...a }))
        : [],
    });
  };

  // Fetch KK records
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["kk-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kk_records")
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
            .from("kk_records")
            .insert({
              user_id: user.id,
              image_url: urlData.publicUrl,
              status: "pending",
            });

          if (insertError) throw insertError;
        }

        toast({ title: "Berhasil", description: "File berhasil diupload" });
        queryClient.invalidateQueries({ queryKey: ["kk-records"] });
        log({ action: "upload", entityType: "kk", description: `Mengupload ${files.length} berkas KK untuk diproses` });
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
      const { data, error } = await supabase.functions.invoke("scan-kk", {
        body: { imageUrl: record.image_url, recordId: record.id },
      });
      if (error) {
        try {
          const errBody = await (error as any).context?.json?.();
          if (errBody?.error) throw new Error(errBody.error);
        } catch (e) {
          if ((e as Error).message !== error.message) throw e;
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Scan berhasil", description: "Data KK berhasil diekstrak" });
      queryClient.invalidateQueries({ queryKey: ["kk-records"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      log({ action: "scan", entityType: "kk", description: `Scan KK berhasil diekstrak` });
    },
    onError: (err: any) => {
      if (err.message.toLocaleLowerCase().includes("rate limit") || err.message.includes("429")) {
        setCooldown(60);
      }
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
          .from("kk_records")
          .insert({
            user_id: user.id,
            image_url: urlData.publicUrl,
            status: "pending",
          })
          .select()
          .single();

        if (insertError) throw insertError;

        toast({ title: "Berhasil foto", description: "Memulai proses OCR langsung..." });
        queryClient.invalidateQueries({ queryKey: ["kk-records"] });
        log({ action: "upload", entityType: "kk", description: `Mengambil foto KK untuk OCR` });

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
      const { error } = await supabase.from("kk_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Berhasil dihapus" });
      queryClient.invalidateQueries({ queryKey: ["kk-records"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      log({ action: "delete", entityType: "kk", description: "Menghapus berkas KK" });
    },
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("kk_records")
        .update({
          no_kk: data.no_kk ?? null,
          kepala_keluarga: data.kepala_keluarga ?? null,
          alamat: data.alamat ?? null,
          rt_rw: data.rt_rw ?? null,
          kelurahan: data.kelurahan ?? null,
          kecamatan: data.kecamatan ?? null,
          kabupaten: data.kabupaten ?? null,
          provinsi: data.provinsi ?? null,
          anggota: data.anggota ?? [],
          status: "scanned",
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Data KK berhasil diperbarui" });
      queryClient.invalidateQueries({ queryKey: ["kk-records"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      log({
        action: "edit",
        entityType: "kk",
        entityId: editRecord?.id,
        entityName: editRecord?.kepala_keluarga ?? editRecord?.no_kk,
        description: `Mengedit data KK "${editRecord?.kepala_keluarga ?? editRecord?.no_kk}" secara manual`,
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

        // Try to read "Data KK" sheet first, fallback to first sheet
        const kkSheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("data kk")) || wb.SheetNames[0];
        const kkSheet = wb.Sheets[kkSheetName];
        const kkRows: any[] = XLSX.utils.sheet_to_json(kkSheet).map(normalizeRow);

        // Try to read "Anggota Keluarga" sheet
        const anggotaSheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("anggota"));
        const anggotaRows: any[] = anggotaSheetName
          ? XLSX.utils.sheet_to_json(wb.Sheets[anggotaSheetName]).map(normalizeRow)
          : [];

        let imported = 0;
        for (const row of kkRows) {
          const noKK = row["no kk"] || row["no_kk"] || row["nomor kk"] || "";
          const anggota = anggotaRows
            .filter((a: any) => (a["no kk"] || a["no_kk"] || a["nomor kk"] || "") === noKK)
            .map((a: any) => ({
              nama: a["nama"] || a["nama lengkap"] || "",
              nik: a["nik"] || a["nomor nik"] || "",
              jenis_kelamin: a["jenis kelamin"] || a["jenis_kelamin"] || a["jk"] || "",
              tempat_lahir: a["tempat lahir"] || a["tempat_lahir"] || "",
              tanggal_lahir: a["tanggal lahir"] || a["tanggal_lahir"] || a["tgl lahir"] || "",
              agama: a["agama"] || "",
              pendidikan: a["pendidikan"] || a["ijazah"] || "",
              pekerjaan: a["pekerjaan"] || a["profesi"] || "",
              status_perkawinan: a["status perkawinan"] || a["status_perkawinan"] || a["status kawin"] || "",
              hubungan_keluarga: a["hubungan keluarga"] || a["hubungan_keluarga"] || a["shdk"] || "",
              kewarganegaraan: a["kewarganegaraan"] || a["wni/wna"] || "",
            }));

          const { error: insertError } = await supabase.from("kk_records").insert({
            user_id: user.id,
            image_url: "",
            no_kk: String(noKK),
            kepala_keluarga: row["kepala keluarga"] || row["kepala_keluarga"] || row["nama kepala keluarga"] || "",
            alamat: row["alamat"] || row["alamat lengkap"] || "",
            rt_rw: row["rt/rw"] || row["rt_rw"] || row["rt rw"] || row["rtrw"] || "",
            kelurahan: row["kelurahan"] || row["desa"] || row["kel/desa"] || "",
            kecamatan: row["kecamatan"] || "",
            kabupaten: row["kabupaten"] || row["kota"] || row["kab/kota"] || "",
            provinsi: row["provinsi"] || "",
            anggota: anggota.length > 0 ? anggota : [],
            status: "scanned",
          });

          if (insertError) throw insertError;
          imported++;
        }

        toast({ title: "Import berhasil", description: `${imported} data KK berhasil diimport` });
        queryClient.invalidateQueries({ queryKey: ["kk-records"] });
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
      "No KK": r.no_kk || "-",
      "Kepala Keluarga": r.kepala_keluarga || "-",
      "Alamat": r.alamat || "-",
      "RT/RW": r.rt_rw || "-",
      "Kelurahan": r.kelurahan || "-",
      "Kecamatan": r.kecamatan || "-",
      "Kabupaten": r.kabupaten || "-",
      "Provinsi": r.provinsi || "-",
      "Jumlah Anggota": Array.isArray(r.anggota) ? r.anggota.length : 0,
    }));

    const membersData: any[] = [];
    scannedRecords.forEach((r: any) => {
      if (Array.isArray(r.anggota)) {
        r.anggota.forEach((a: any) => {
          membersData.push({
            "No KK": r.no_kk || "-",
            "Nama": a.nama || "-",
            "NIK": a.nik || "-",
            "Jenis Kelamin": a.jenis_kelamin || "-",
            "Tempat Lahir": a.tempat_lahir || "-",
            "Tanggal Lahir": a.tanggal_lahir || "-",
            "Agama": a.agama || "-",
            "Pendidikan": a.pendidikan || "-",
            "Pekerjaan": a.pekerjaan || "-",
            "Status Perkawinan": a.status_perkawinan || "-",
            "Hubungan Keluarga": a.hubungan_keluarga || "-",
            "Kewarganegaraan": a.kewarganegaraan || "-",
          });
        });
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Data KK");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(membersData), "Anggota Keluarga");
    XLSX.writeFile(wb, `Berkas_KK_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

    toast({ title: "Berhasil", description: "File Excel berhasil diunduh" });
  };

  // Download template Excel
  const downloadTemplate = () => {
    const templateKK = [
      {
        "No KK": "3273010101010001",
        "Kepala Keluarga": "BUDI SANTOSO",
        "Alamat": "JL. MERDEKA NO. 10",
        "RT/RW": "001/002",
        "Kelurahan": "SUKAMAJU",
        "Kecamatan": "CIBEUNYING",
        "Kabupaten": "KOTA BANDUNG",
        "Provinsi": "JAWA BARAT",
      },
    ];
    const templateAnggota = [
      {
        "No KK": "3273010101010001",
        "Nama": "BUDI SANTOSO",
        "NIK": "3273010101800001",
        "Jenis Kelamin": "Laki-laki",
        "Tempat Lahir": "BANDUNG",
        "Tanggal Lahir": "01-01-1980",
        "Agama": "ISLAM",
        "Pendidikan": "S1",
        "Pekerjaan": "PEGAWAI SWASTA",
        "Status Perkawinan": "KAWIN",
        "Hubungan Keluarga": "KEPALA KELUARGA",
        "Kewarganegaraan": "WNI",
      },
      {
        "No KK": "3273010101010001",
        "Nama": "SITI RAHAYU",
        "NIK": "3273015505820002",
        "Jenis Kelamin": "Perempuan",
        "Tempat Lahir": "BANDUNG",
        "Tanggal Lahir": "15-05-1982",
        "Agama": "ISLAM",
        "Pendidikan": "S1",
        "Pekerjaan": "IBU RUMAH TANGGA",
        "Status Perkawinan": "KAWIN",
        "Hubungan Keluarga": "ISTRI",
        "Kewarganegaraan": "WNI",
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateKK), "Data KK");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateAnggota), "Anggota Keluarga");
    XLSX.writeFile(wb, "Template_Import_KK.xlsx");
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
              <h1 className="text-2xl font-bold text-foreground">Berkas KK</h1>
              <p className="text-sm text-muted-foreground">
                Scan dan kelola data Kartu Keluarga
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0">
              <Button
                variant="outline"
                onClick={() => {
                  const scanned = records.filter((r: any) => r.status === "scanned");
                  printData({
                    title: "Daftar Berkas Kartu Keluarga",
                    subtitle: `Total: ${scanned.length} KK sudah discan`,
                    columns: [
                      { header: "#", key: "_no", width: "40px" },
                      { header: "No. KK", key: "no_kk", width: "160px" },
                      { header: "Kepala Keluarga", key: "kepala_keluarga", width: "180px" },
                      { header: "Alamat", key: "alamat" },
                      { header: "RT/RW", key: "rt_rw", width: "60px" },
                      { header: "Kelurahan", key: "kelurahan" },
                      { header: "Kecamatan", key: "kecamatan" },
                      { header: "Anggota", key: "_anggota", width: "60px" },
                    ],
                    data: scanned.map((r: any, i: number) => ({
                      ...r,
                      _no: i + 1,
                      _anggota: Array.isArray(r.anggota) ? r.anggota.length : 0,
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
                    Upload KK
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
                    Foto KK (OCR)
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
              <h2 className="text-lg font-semibold text-foreground">Daftar Berkas KK</h2>
            </div>

            {isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
              </div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Belum ada berkas KK. Upload gambar KK untuk mulai.
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
                          alt="KK"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {record.kepala_keluarga
                            ? record.kepala_keluarga
                            : record.no_kk
                              ? `KK: ${record.no_kk}`
                              : record.status === "scanned"
                                ? "Data tidak lengkap"
                                : "Belum discan"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {record.no_kk
                            ? `No. KK: ${record.no_kk}`
                            : format(new Date(record.created_at), "dd MMM yyyy HH:mm", {
                              locale: localeId,
                            })}
                        </p>
                        {record.status === "scanned" && Array.isArray(record.anggota) && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{record.anggota.length} anggota</span>
                          </div>
                        )}
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
                        title="Edit data KK"
                        onClick={() => openEdit(record)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {record.status === "pending" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => scanMutation.mutate(record)}
                          disabled={scanningId === record.id || cooldown > 0}
                        >
                          {scanningId === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : cooldown > 0 ? (
                            <Clock className="h-4 w-4" />
                          ) : (
                            <FileSearch className="h-4 w-4" />
                          )}
                          <span className="ml-1">
                            {cooldown > 0 ? `Tunggu ${cooldown}s` : "Scan"}
                          </span>
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
              <Users className="h-5 w-5 text-primary" />
              Detail Kartu Keluarga
            </DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-5">
              {/* Gambar KK */}
              {viewRecord.image_url ? (
                <div className="rounded-xl overflow-hidden border border-border">
                  <img
                    src={viewRecord.image_url}
                    alt="Foto KK"
                    className="w-full object-contain max-h-64"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  Tidak ada foto dokumen (data diimport dari Excel)
                </div>
              )}

              {/* Field info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {[
                  { label: "No. KK", val: viewRecord.no_kk },
                  { label: "Kepala Keluarga", val: viewRecord.kepala_keluarga },
                  { label: "Alamat", val: viewRecord.alamat },
                  { label: "RT/RW", val: viewRecord.rt_rw },
                  { label: "Kelurahan", val: viewRecord.kelurahan },
                  { label: "Kecamatan", val: viewRecord.kecamatan },
                  { label: "Kabupaten", val: viewRecord.kabupaten },
                  { label: "Provinsi", val: viewRecord.provinsi },
                ].map((f) => (
                  <div key={f.label} className="p-3 bg-muted/40 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-0.5">{f.label}</p>
                    <p className="font-medium text-foreground">{f.val || "—"}</p>
                  </div>
                ))}
              </div>

              {/* Anggota keluarga */}
              {Array.isArray(viewRecord.anggota) && viewRecord.anggota.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Anggota Keluarga ({viewRecord.anggota.length})
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          {["Nama", "NIK", "L/P", "Hubungan", "Pekerjaan"].map((h) => (
                            <th key={h} className="text-left p-2.5 border-b border-border font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {viewRecord.anggota.map((a: any, i: number) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="p-2.5">{a.nama || "—"}</td>
                            <td className="p-2.5 font-mono text-xs">{a.nik || "—"}</td>
                            <td className="p-2.5">{a.jenis_kelamin || "—"}</td>
                            <td className="p-2.5">{a.hubungan_keluarga || "—"}</td>
                            <td className="p-2.5">{a.pekerjaan || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Data Kartu Keluarga
            </DialogTitle>
          </DialogHeader>

          {editRecord && (
            <div className="space-y-5">
              {/* ── Informasi KK ── */}
              <div className="glass-card rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Informasi Kepala Keluarga
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-nokk">Nomor KK</Label>
                    <Input
                      id="edit-nokk"
                      value={editRecord.no_kk ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, no_kk: e.target.value })}
                      placeholder="16 digit nomor KK"
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-kk">Kepala Keluarga</Label>
                    <Input
                      id="edit-kk"
                      value={editRecord.kepala_keluarga ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, kepala_keluarga: e.target.value })}
                      placeholder="Nama lengkap kepala keluarga"
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
                    <Label htmlFor="edit-kel">Kelurahan / Desa</Label>
                    <Input
                      id="edit-kel"
                      value={editRecord.kelurahan ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, kelurahan: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-kec">Kecamatan</Label>
                    <Input
                      id="edit-kec"
                      value={editRecord.kecamatan ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, kecamatan: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-kab">Kabupaten / Kota</Label>
                    <Input
                      id="edit-kab"
                      value={editRecord.kabupaten ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, kabupaten: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="edit-prov">Provinsi</Label>
                    <Input
                      id="edit-prov"
                      value={editRecord.provinsi ?? ""}
                      onChange={(e) => setEditRecord({ ...editRecord, provinsi: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* ── Anggota Keluarga ── */}
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Anggota Keluarga ({editRecord.anggota?.length ?? 0} orang)
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditRecord({
                      ...editRecord,
                      anggota: [
                        ...(editRecord.anggota ?? []),
                        { nama: "", nik: "", jenis_kelamin: "", hubungan_keluarga: "", pekerjaan: "", tempat_lahir: "", tanggal_lahir: "", agama: "", pendidikan: "", status_perkawinan: "", kewarganegaraan: "WNI" }
                      ]
                    })}
                  >
                    <UserPlus className="h-4 w-4 mr-1.5" /> Tambah Anggota
                  </Button>
                </div>

                {(!editRecord.anggota || editRecord.anggota.length === 0) ? (
                  <div className="py-8 text-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-lg">
                    Belum ada anggota keluarga. Klik "Tambah Anggota" untuk menambahkan.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editRecord.anggota.map((anggota: any, idx: number) => (
                      <div key={idx} className="border border-border rounded-xl p-4 relative group">
                        {/* Hapus anggota */}
                        <button
                          onClick={() => {
                            const upd = [...editRecord.anggota];
                            upd.splice(idx, 1);
                            setEditRecord({ ...editRecord, anggota: upd });
                          }}
                          className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="Hapus anggota"
                        >
                          <X className="h-4 w-4" />
                        </button>

                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                          Anggota #{idx + 1}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {([
                            { key: "nama", label: "Nama Lengkap", placeholder: "Nama" },
                            { key: "nik", label: "NIK", placeholder: "16 digit NIK", mono: true },
                            { key: "jenis_kelamin", label: "Jenis Kelamin", placeholder: "L / P" },
                            { key: "hubungan_keluarga", label: "Hubungan Keluarga", placeholder: "Kepala/Istri/Anak" },
                            { key: "tempat_lahir", label: "Tempat Lahir", placeholder: "Kota" },
                            { key: "tanggal_lahir", label: "Tanggal Lahir", placeholder: "DD-MM-YYYY" },
                            { key: "agama", label: "Agama", placeholder: "Islam/Kristen/dll" },
                            { key: "pendidikan", label: "Pendidikan", placeholder: "SMA/S1/dll" },
                            { key: "pekerjaan", label: "Pekerjaan", placeholder: "Profesi" },
                            { key: "status_perkawinan", label: "Status Kawin", placeholder: "Kawin/Belum Kawin" },
                            { key: "kewarganegaraan", label: "Kewarganegaraan", placeholder: "WNI" },
                          ] as const).map((field) => (
                            <div key={field.key}>
                              <Label className="text-xs">{field.label}</Label>
                              <Input
                                value={anggota[field.key] ?? ""}
                                onChange={(e) => {
                                  const upd = editRecord.anggota.map((a: any, i: number) =>
                                    i === idx ? { ...a, [field.key]: e.target.value } : a
                                  );
                                  setEditRecord({ ...editRecord, anggota: upd });
                                }}
                                placeholder={field.placeholder}
                                className={`mt-0.5 h-8 text-xs ${(field as any).mono ? 'font-mono' : ''}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

export default BerkasKK;
