/* eslint-disable */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, recordId } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Download gambar dan convert ke base64
    console.log("Downloading image:", imageUrl);
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) throw new Error(`Gagal download gambar: ${imgResponse.status}`);
    const imgBuffer = await imgResponse.arrayBuffer();
    const imgBytes = new Uint8Array(imgBuffer);

    // Convert ke base64 (chunk agar tidak stack overflow)
    let binary = "";
    const chunkSize = 1024;
    for (let i = 0; i < imgBytes.length; i += chunkSize) {
      const chunk = imgBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const imageData = btoa(binary);

    let imageMimeType = "image/jpeg";
    if (imageUrl.toLowerCase().includes(".png")) imageMimeType = "image/png";
    else if (imageUrl.toLowerCase().includes(".webp")) imageMimeType = "image/webp";

    console.log("Calling Gemini API, image size:", imgBytes.length);

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Kamu adalah OCR expert untuk dokumen Kartu Tanda Penduduk (KTP) Indonesia.
Ekstrak semua data dari gambar KTP ini dan kembalikan HANYA dalam format JSON berikut (tanpa markdown, tanpa kode block, tanpa penjelasan tambahan):
{
  "nik": "16 digit NIK",
  "nama": "nama lengkap",
  "tempat_lahir": "tempat lahir",
  "tanggal_lahir": "tanggal lahir format DD-MM-YYYY",
  "jenis_kelamin": "LAKI-LAKI atau PEREMPUAN",
  "golongan_darah": "A/B/AB/O/-",
  "alamat": "alamat tempat tinggal",
  "rt_rw": "RT/RW seperti 001/002",
  "kelurahan": "kelurahan/desa",
  "kecamatan": "kecamatan",
  "agama": "agama",
  "status_perkawinan": "status perkawinan",
  "pekerjaan": "pekerjaan",
  "kewarganegaraan": "WNI atau WNA"
}
Jika ada data yang tidak terbaca, isi dengan string kosong "".`
              },
              {
                inline_data: {
                  mime_type: imageMimeType,
                  data: imageData,
                }
              }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
      }
    );

    console.log("Gemini response status:", aiResponse.status);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Terlalu banyak permintaan ke Gemini, coba lagi nanti." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Gemini API error ${aiResponse.status}: ${errText.substring(0, 200)}`);
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Gemini tidak mengembalikan data");

    console.log("Gemini raw text:", rawText.substring(0, 300));

    let extractedData: any;
    try {
      const cleaned = rawText.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
      extractedData = JSON.parse(cleaned);
    } catch {
      throw new Error("Gagal parse JSON dari Gemini: " + rawText.substring(0, 100));
    }

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
    console.error("scan-ktp error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
