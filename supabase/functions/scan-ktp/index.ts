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

function extractNIK(text: string): string {
  const match = text.match(/\b(\d{16})\b/);
  return match ? match[1] : "";
}

function parseKTPText(text: string): any {
  const fullText = text;

  const nik = extractNIK(fullText);
  const nama = extractField(fullText, "Nama", "NAMA");

  let tempat_lahir = "";
  let tanggal_lahir = "";
  const ttlMatch = fullText.match(/Tempat\s*[\/]?\s*Tgl\s*Lahir\s*[:\s]+([^,\n]+)[,\s]+(\d{2}-\d{2}-\d{4})/i);
  if (ttlMatch) {
    tempat_lahir = ttlMatch[1].trim();
    tanggal_lahir = ttlMatch[2].trim();
  } else {
    tempat_lahir = extractField(fullText, "Tempat Lahir", "Tempat\\/Tgl Lahir");
    const tglMatch = fullText.match(/(\d{2}-\d{2}-\d{4})/);
    if (tglMatch) tanggal_lahir = tglMatch[1];
  }

  let jenis_kelamin = extractField(fullText, "Jenis Kelamin", "Jenis\\/Kelamin");
  if (!jenis_kelamin) {
    if (/LAKI-LAKI/i.test(fullText)) jenis_kelamin = "LAKI-LAKI";
    else if (/PEREMPUAN/i.test(fullText)) jenis_kelamin = "PEREMPUAN";
  }

  let golongan_darah = extractField(fullText, "Gol\\. Darah", "Golongan Darah");
  if (!golongan_darah) {
    const gdMatch = fullText.match(/\b(A|B|AB|O)\b/);
    if (gdMatch) golongan_darah = gdMatch[1];
  }

  const alamat = extractField(fullText, "Alamat", "ALAMAT");
  const rt_rw = extractField(fullText, "RT\\/RW", "RTRW", "RT/RW");
  const kelurahan = extractField(fullText, "Kel\\/Desa", "Kelurahan", "KELURAHAN");
  const kecamatan = extractField(fullText, "Kecamatan", "KECAMATAN");
  const agama = extractField(fullText, "Agama", "AGAMA");
  const status_perkawinan = extractField(fullText, "Status Perkawinan", "Status Perkawin");
  const pekerjaan = extractField(fullText, "Pekerjaan", "PEKERJAAN");

  let kewarganegaraan = extractField(fullText, "Kewarganegaraan");
  if (!kewarganegaraan) {
    if (/WNI/i.test(fullText)) kewarganegaraan = "WNI";
    else if (/WNA/i.test(fullText)) kewarganegaraan = "WNA";
  }

  return { nik, nama, tempat_lahir, tanggal_lahir, jenis_kelamin, golongan_darah, alamat, rt_rw, kelurahan, kecamatan, agama, status_perkawinan, pekerjaan, kewarganegaraan };
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
      throw new Error("OCR.space respons tidak valid: " + ocrText.substring(0, 200));
    }

    if (ocrData.IsErroredOnProcessing) {
      throw new Error(`OCR error: ${JSON.stringify(ocrData.ErrorMessage)}`);
    }

    const rawText = ocrData.ParsedResults?.[0]?.ParsedText || "";
    if (!rawText.trim()) throw new Error("OCR tidak bisa membaca teks dari gambar");

    console.log("OCR text:", rawText.substring(0, 300));

    const extractedData = parseKTPText(rawText);
    console.log("Parsed KTP:", JSON.stringify(extractedData));

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

    if (updateError) throw new Error("Gagal simpan ke DB: " + updateError.message);

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-ktp error:", e?.message || e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
