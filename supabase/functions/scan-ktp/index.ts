/* eslint-disable */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
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

    // Download gambar
    console.log("Step 1: Downloading image:", imageUrl);
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) throw new Error(`Gagal download gambar: HTTP ${imgResp.status} ${imgResp.statusText}`);

    const imgBuffer = await imgResp.arrayBuffer();
    const imgBytes = new Uint8Array(imgBuffer);
    console.log("Step 2: Image size:", imgBytes.length, "bytes");

    // Encode base64 menggunakan Deno std library
    const base64str = encodeBase64(imgBytes);
    const base64Image = `data:image/jpeg;base64,${base64str}`;
    console.log("Step 3: Base64 length:", base64str.length);

    // Kirim ke OCR.space
    const params = new URLSearchParams({
      apikey: OCR_API_KEY,
      base64Image: base64Image,
      language: "eng",
      isOverlayRequired: "false",
      detectOrientation: "true",
      scale: "true",
      OCREngine: "2",
    });

    console.log("Step 4: Calling OCR.space...");
    const ocrResp = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    console.log("Step 5: OCR.space status:", ocrResp.status);
    const ocrText = await ocrResp.text();
    console.log("Step 6: OCR.space response:", ocrText.substring(0, 600));

    let ocrData: any;
    try {
      ocrData = JSON.parse(ocrText);
    } catch {
      throw new Error("OCR.space respons bukan JSON: " + ocrText.substring(0, 200));
    }

    if (ocrData.IsErroredOnProcessing) {
      throw new Error(`OCR.space error: ${JSON.stringify(ocrData.ErrorMessage)}`);
    }

    const rawText = ocrData.ParsedResults?.[0]?.ParsedText || "";
    console.log("Step 7: OCR text length:", rawText.length);
    if (!rawText.trim()) throw new Error("OCR tidak menghasilkan teks (gambar mungkin buram/kosong)");

    const extractedData = parseKTPText(rawText);
    console.log("Step 8: Extracted:", JSON.stringify(extractedData));

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

    if (updateError) throw new Error("DB update error: " + updateError.message);

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("scan-ktp FATAL:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
