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

/** Ekstrak nomor 16 digit (No KK atau NIK) */
function extract16Digit(text: string, offset = 0): string {
  const matches = [...text.matchAll(/\b(\d{16})\b/g)];
  return matches[offset] ? matches[offset][1] : "";
}

/** Parse anggota keluarga dari teks KK */
function parseAnggotaKK(text: string): any[] {
  // Coba detect baris-baris yang mengandung NIK (16 digit) sebagai anggota
  const anggota: any[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const nikMatch = lines[i].match(/\b(\d{16})\b/);
    if (nikMatch) {
      const nik = nikMatch[1];
      // Nama biasanya muncul sebelum/sesudah NIK di baris yang sama atau baris sebelumnya
      const namaLine = lines[i].replace(nik, "").trim() || (i > 0 ? lines[i - 1] : "");
      const nama = namaLine.replace(/^\d+\.?\s*/, "").trim(); // hapus nomor urut
      if (nama && nama.length > 2) {
        anggota.push({
          nama,
          nik,
          jenis_kelamin: "",
          tempat_lahir: "",
          tanggal_lahir: "",
          agama: "",
          pendidikan: "",
          pekerjaan: "",
          status_perkawinan: "",
          hubungan_keluarga: "",
          kewarganegaraan: "WNI",
        });
      }
    }
  }
  return anggota;
}

/** Parse teks OCR KK menjadi objek terstruktur */
function parseKKText(text: string): any {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join("\n");

  // No KK — 16 digit pertama yang ditemukan
  const no_kk = extract16Digit(fullText, 0);

  // Kepala Keluarga
  const kepala_keluarga = extractField(fullText, "Kepala Keluarga", "Nama Kepala", "KEPALA KELUARGA");

  // Alamat
  const alamat = extractField(fullText, "Alamat", "ALAMAT");

  // RT/RW
  const rt_rw = extractField(fullText, "RT\\/RW", "RT/RW", "RTRW");

  // Kelurahan
  const kelurahan = extractField(fullText, "Kel\\/Desa", "Kelurahan", "Desa");

  // Kecamatan
  const kecamatan = extractField(fullText, "Kecamatan");

  // Kabupaten/Kota
  const kabupaten = extractField(fullText, "Kabupaten", "Kota", "Kab\\/Kota");

  // Provinsi
  const provinsi = extractField(fullText, "Provinsi");

  // Anggota keluarga dari teks
  const anggota = parseAnggotaKK(fullText);

  return {
    no_kk,
    kepala_keluarga,
    alamat,
    rt_rw,
    kelurahan,
    kecamatan,
    kabupaten,
    provinsi,
    anggota,
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

    // Parse teks OCR menjadi field-field KK
    const extractedData = parseKKText(rawText);
    console.log("Extracted KK data:", extractedData);

    // Update record di database
    const { error: updateError } = await supabase
      .from("kk_records")
      .update({
        no_kk: extractedData.no_kk || null,
        kepala_keluarga: extractedData.kepala_keluarga || null,
        alamat: extractedData.alamat || null,
        rt_rw: extractedData.rt_rw || null,
        kelurahan: extractedData.kelurahan || null,
        kecamatan: extractedData.kecamatan || null,
        kabupaten: extractedData.kabupaten || null,
        provinsi: extractedData.provinsi || null,
        anggota: extractedData.anggota || [],
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
    console.error("scan-kk error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
