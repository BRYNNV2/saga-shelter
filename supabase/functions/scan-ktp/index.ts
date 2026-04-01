/* eslint-disable */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Ambil nilai dari teks OCR berdasarkan label */
function extractField(text: string, ...labels: string[]): string {
  for (const label of labels) {
    const regex = new RegExp(label + "[\\s:]+([^\\n]+)", "i");
    const match = text.match(regex);
    if (match) return match[1].trim();
  }
  return "";
}

/** Ekstrak NIK (16 digit angka) */
function extractNIK(text: string): string {
  const match = text.match(/\b(\d{16})\b/);
  return match ? match[1] : "";
}

/** Parse teks OCR KTP menjadi objek terstruktur */
function parseKTPText(text: string): any {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join("\n");

  // NIK
  const nik = extractNIK(fullText);

  // Nama — biasanya di baris setelah "Nama"
  const nama = extractField(fullText, "Nama", "NAMA");

  // Tempat & tanggal lahir — format: Tempat Tgl Lahir : KOTA, DD-MM-YYYY
  let tempat_lahir = "";
  let tanggal_lahir = "";
  const ttlMatch = fullText.match(/Tempat\s*[\/]?\s*Tgl\s*Lahir\s*[:\s]+([^,\n]+)[,\s]+(\d{2}-\d{2}-\d{4})/i);
  if (ttlMatch) {
    tempat_lahir = ttlMatch[1].trim();
    tanggal_lahir = ttlMatch[2].trim();
  } else {
    tempat_lahir = extractField(fullText, "Tempat Lahir", "Tempat/Tgl Lahir");
    // Cari tanggal format DD-MM-YYYY
    const tglMatch = fullText.match(/(\d{2}-\d{2}-\d{4})/);
    if (tglMatch) tanggal_lahir = tglMatch[1];
  }

  // Jenis Kelamin
  let jenis_kelamin = extractField(fullText, "Jenis Kelamin", "Jenis\\/Kelamin");
  if (!jenis_kelamin) {
    if (/LAKI-LAKI/i.test(fullText)) jenis_kelamin = "LAKI-LAKI";
    else if (/PEREMPUAN/i.test(fullText)) jenis_kelamin = "PEREMPUAN";
  }

  // Golongan darah
  let golongan_darah = extractField(fullText, "Gol\\. Darah", "Golongan Darah");
  if (!golongan_darah) {
    const gdMatch = fullText.match(/\b(A|B|AB|O)\b/);
    if (gdMatch) golongan_darah = gdMatch[1];
  }

  // Alamat
  const alamat = extractField(fullText, "Alamat", "ALAMAT");

  // RT/RW
  const rt_rw = extractField(fullText, "RT\\/RW", "RTRW", "RT/RW");

  // Kelurahan/Desa
  const kelurahan = extractField(fullText, "Kel\\/Desa", "Kelurahan", "KELURAHAN");

  // Kecamatan
  const kecamatan = extractField(fullText, "Kecamatan", "KECAMATAN");

  // Agama
  const agama = extractField(fullText, "Agama", "AGAMA");

  // Status Perkawinan
  const status_perkawinan = extractField(fullText, "Status Perkawinan", "Status Perkawin", "PERKAWINAN");

  // Pekerjaan
  const pekerjaan = extractField(fullText, "Pekerjaan", "PEKERJAAN");

  // Kewarganegaraan
  let kewarganegaraan = extractField(fullText, "Kewarganegaraan");
  if (!kewarganegaraan) {
    if (/WNI/i.test(fullText)) kewarganegaraan = "WNI";
    else if (/WNA/i.test(fullText)) kewarganegaraan = "WNA";
  }

  return {
    nik,
    nama,
    tempat_lahir,
    tanggal_lahir,
    jenis_kelamin,
    golongan_darah,
    alamat,
    rt_rw,
    kelurahan,
    kecamatan,
    agama,
    status_perkawinan,
    pekerjaan,
    kewarganegaraan,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, recordId } = await req.json();

    // Gunakan OCRSPACE_API_KEY jika ada, fallback ke demo key "helloworld"
    const OCR_API_KEY = Deno.env.get("OCRSPACE_API_KEY") || "helloworld";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Kirim URL gambar ke OCR.space
    const formData = new FormData();
    formData.append("apikey", OCR_API_KEY);
    formData.append("url", imageUrl);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");
    formData.append("detectOrientation", "true");
    formData.append("scale", "true");
    formData.append("OCREngine", "2"); // Engine 2 lebih akurat

    const ocrResponse = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData,
    });

    if (!ocrResponse.ok) {
      const errText = await ocrResponse.text();
      throw new Error(`OCR.space error: ${ocrResponse.status} - ${errText}`);
    }

    const ocrData = await ocrResponse.json();

    if (ocrData.IsErroredOnProcessing) {
      throw new Error(`OCR gagal: ${ocrData.ErrorMessage}`);
    }

    const rawText = ocrData.ParsedResults?.[0]?.ParsedText || "";
    console.log("OCR raw text:", rawText);

    if (!rawText.trim()) {
      throw new Error("OCR tidak bisa membaca teks dari gambar");
    }

    // Parse teks OCR menjadi field-field KTP
    const extractedData = parseKTPText(rawText);
    console.log("Extracted KTP data:", extractedData);

    // Update record di database
    const { error: updateError } = await supabase
      .from("ktp_records")
      .update({
        nik: extractedData.nik || null,
        nama: extractedData.nama || null,
        tempat_lahir: extractedData.tempat_lahir || null,
        tanggal_lahir: extractedData.tanggal_lahir || null,
        jenis_kelamin: extractedData.jenis_kelamin || null,
        golongan_darah: extractedData.golongan_darah || null,
        alamat: extractedData.alamat || null,
        rt_rw: extractedData.rt_rw || null,
        kelurahan: extractedData.kelurahan || null,
        kecamatan: extractedData.kecamatan || null,
        agama: extractedData.agama || null,
        status_perkawinan: extractedData.status_perkawinan || null,
        pekerjaan: extractedData.pekerjaan || null,
        kewarganegaraan: extractedData.kewarganegaraan || null,
        status: "scanned",
      })
      .eq("id", recordId);

    if (updateError) {
      console.error("DB update error:", updateError);
      throw new Error("Failed to update record");
    }

    return new Response(JSON.stringify({ success: true, data: extractedData, rawText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-ktp error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
