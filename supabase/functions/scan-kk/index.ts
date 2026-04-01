/* eslint-disable */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractField(text: string, ...labels: string[]): string {
  for (const label of labels) {
    const regex = new RegExp(label + "[\\s:]+([^\\n]+)", "i");
    const match = text.match(regex);
    if (match) return match[1].trim();
  }
  return "";
}

function extract16Digit(text: string, offset = 0): string {
  const matches = [...text.matchAll(/\b(\d{16})\b/g)];
  return matches[offset] ? matches[offset][1] : "";
}

function parseAnggotaKK(text: string): any[] {
  const anggota: any[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const nikMatch = lines[i].match(/\b(\d{16})\b/);
    if (nikMatch) {
      const nik = nikMatch[1];
      const namaLine = lines[i].replace(nik, "").trim() || (i > 0 ? lines[i - 1] : "");
      const nama = namaLine.replace(/^\d+\.?\s*/, "").trim();
      if (nama && nama.length > 2) {
        anggota.push({ nama, nik, jenis_kelamin: "", tempat_lahir: "", tanggal_lahir: "", agama: "", pendidikan: "", pekerjaan: "", status_perkawinan: "", hubungan_keluarga: "", kewarganegaraan: "WNI" });
      }
    }
  }
  return anggota;
}

function parseKKText(text: string): any {
  const fullText = text;
  const no_kk = extract16Digit(fullText, 0);
  const kepala_keluarga = extractField(fullText, "Kepala Keluarga", "Nama Kepala", "KEPALA KELUARGA");
  const alamat = extractField(fullText, "Alamat", "ALAMAT");
  const rt_rw = extractField(fullText, "RT\\/RW", "RT/RW", "RTRW");
  const kelurahan = extractField(fullText, "Kel\\/Desa", "Kelurahan", "Desa");
  const kecamatan = extractField(fullText, "Kecamatan");
  const kabupaten = extractField(fullText, "Kabupaten", "Kota", "Kab\\/Kota");
  const provinsi = extractField(fullText, "Provinsi");
  const anggota = parseAnggotaKK(fullText);
  return { no_kk, kepala_keluarga, alamat, rt_rw, kelurahan, kecamatan, kabupaten, provinsi, anggota };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, recordId } = await req.json();
    if (!imageUrl) throw new Error("imageUrl diperlukan");

    const OCR_API_KEY = Deno.env.get("OCRSPACE_API_KEY") || "helloworld";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Download gambar dan convert ke base64
    console.log("Downloading image:", imageUrl);
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) throw new Error(`Gagal download gambar: ${imgResp.status}`);
    const imgBuffer = await imgResp.arrayBuffer();
    const imgBytes = new Uint8Array(imgBuffer);

    // Convert ke base64
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < imgBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...imgBytes.slice(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    const base64Image = `data:image/jpeg;base64,${base64}`;

    // Kirim ke OCR.space via base64
    const params = new URLSearchParams();
    params.append("apikey", OCR_API_KEY);
    params.append("base64Image", base64Image);
    params.append("language", "eng");
    params.append("isOverlayRequired", "false");
    params.append("detectOrientation", "true");
    params.append("scale", "true");
    params.append("OCREngine", "2");

    console.log("Calling OCR.space API...");
    const ocrResp = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const ocrText = await ocrResp.text();
    console.log("OCR.space raw response:", ocrText.substring(0, 500));

    let ocrData: any;
    try {
      ocrData = JSON.parse(ocrText);
    } catch {
      throw new Error("OCR.space mengembalikan respons tidak valid: " + ocrText.substring(0, 200));
    }

    if (ocrData.IsErroredOnProcessing) {
      throw new Error(`OCR error: ${JSON.stringify(ocrData.ErrorMessage)}`);
    }

    const rawText = ocrData.ParsedResults?.[0]?.ParsedText || "";
    if (!rawText.trim()) throw new Error("OCR tidak bisa membaca teks dari gambar");

    console.log("OCR text:", rawText.substring(0, 300));

    const extractedData = parseKKText(rawText);
    console.log("Parsed KK:", JSON.stringify(extractedData));

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

    if (updateError) throw new Error("Gagal simpan ke DB: " + updateError.message);

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-kk error:", e?.message || e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
