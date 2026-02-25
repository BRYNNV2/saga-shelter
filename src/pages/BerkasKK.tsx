import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";

const BerkasKK = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [viewRecord, setViewRecord] = useState<any>(null);

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
    [user, toast, queryClient]
  );

  // Scan mutation
  const scanMutation = useMutation({
    mutationFn: async (record: any) => {
      setScanningId(record.id);
      const { data, error } = await supabase.functions.invoke("scan-kk", {
        body: { imageUrl: record.image_url, recordId: record.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Scan berhasil", description: "Data KK berhasil diekstrak" });
      queryClient.invalidateQueries({ queryKey: ["kk-records"] });
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kk_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Berhasil dihapus" });
      queryClient.invalidateQueries({ queryKey: ["kk-records"] });
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

        // Try to read "Data KK" sheet first, fallback to first sheet
        const kkSheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("data kk")) || wb.SheetNames[0];
        const kkSheet = wb.Sheets[kkSheetName];
        const kkRows: any[] = XLSX.utils.sheet_to_json(kkSheet);

        // Try to read "Anggota Keluarga" sheet
        const anggotaSheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("anggota"));
        const anggotaRows: any[] = anggotaSheetName
          ? XLSX.utils.sheet_to_json(wb.Sheets[anggotaSheetName])
          : [];

        let imported = 0;
        for (const row of kkRows) {
          const noKK = row["No KK"] || row["no_kk"] || row["NO KK"] || "";
          const anggota = anggotaRows
            .filter((a: any) => (a["No KK"] || a["no_kk"] || a["NO KK"] || "") === noKK)
            .map((a: any) => ({
              nama: a["Nama"] || a["nama"] || "",
              nik: a["NIK"] || a["nik"] || "",
              jenis_kelamin: a["Jenis Kelamin"] || a["jenis_kelamin"] || "",
              tempat_lahir: a["Tempat Lahir"] || a["tempat_lahir"] || "",
              tanggal_lahir: a["Tanggal Lahir"] || a["tanggal_lahir"] || "",
              agama: a["Agama"] || a["agama"] || "",
              pendidikan: a["Pendidikan"] || a["pendidikan"] || "",
              pekerjaan: a["Pekerjaan"] || a["pekerjaan"] || "",
              status_perkawinan: a["Status Perkawinan"] || a["status_perkawinan"] || "",
              hubungan_keluarga: a["Hubungan Keluarga"] || a["hubungan_keluarga"] || "",
              kewarganegaraan: a["Kewarganegaraan"] || a["kewarganegaraan"] || "",
            }));

          const { error: insertError } = await supabase.from("kk_records").insert({
            user_id: user.id,
            image_url: "",
            no_kk: String(noKK),
            kepala_keluarga: row["Kepala Keluarga"] || row["kepala_keluarga"] || "",
            alamat: row["Alamat"] || row["alamat"] || "",
            rt_rw: row["RT/RW"] || row["rt_rw"] || "",
            kelurahan: row["Kelurahan"] || row["kelurahan"] || "",
            kecamatan: row["Kecamatan"] || row["kecamatan"] || "",
            kabupaten: row["Kabupaten"] || row["kabupaten"] || "",
            provinsi: row["Provinsi"] || row["provinsi"] || "",
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

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Berkas KK</h1>
              <p className="text-sm text-muted-foreground">
                Scan dan kelola data Kartu Keluarga
              </p>
            </div>
            <div className="flex items-center gap-3">
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
              <div className="divide-y divide-border">
                {records.map((record: any) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-5 hover:bg-muted/50 transition-colors"
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
                          {record.kepala_keluarga || "Belum discan"}
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
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={record.status === "scanned" ? "default" : "outline"}
                      >
                        {record.status === "scanned" ? "Selesai" : "Pending"}
                      </Badge>

                      {record.status === "scanned" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewRecord(record)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}

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
            )}
          </div>
        </div>
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!viewRecord} onOpenChange={() => setViewRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Kartu Keluarga</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">No. KK</p>
                  <p className="font-medium">{viewRecord.no_kk || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kepala Keluarga</p>
                  <p className="font-medium">{viewRecord.kepala_keluarga || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Alamat</p>
                  <p className="font-medium">{viewRecord.alamat || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">RT/RW</p>
                  <p className="font-medium">{viewRecord.rt_rw || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kelurahan</p>
                  <p className="font-medium">{viewRecord.kelurahan || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kecamatan</p>
                  <p className="font-medium">{viewRecord.kecamatan || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kabupaten</p>
                  <p className="font-medium">{viewRecord.kabupaten || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Provinsi</p>
                  <p className="font-medium">{viewRecord.provinsi || "-"}</p>
                </div>
              </div>

              {Array.isArray(viewRecord.anggota) && viewRecord.anggota.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Anggota Keluarga</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-border rounded-lg">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-2 border-b border-border">Nama</th>
                          <th className="text-left p-2 border-b border-border">NIK</th>
                          <th className="text-left p-2 border-b border-border">L/P</th>
                          <th className="text-left p-2 border-b border-border">Hubungan</th>
                          <th className="text-left p-2 border-b border-border">Pekerjaan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewRecord.anggota.map((a: any, i: number) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="p-2 border-b border-border">{a.nama || "-"}</td>
                            <td className="p-2 border-b border-border">{a.nik || "-"}</td>
                            <td className="p-2 border-b border-border">{a.jenis_kelamin || "-"}</td>
                            <td className="p-2 border-b border-border">{a.hubungan_keluarga || "-"}</td>
                            <td className="p-2 border-b border-border">{a.pekerjaan || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BerkasKK;
