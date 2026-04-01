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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Kamu adalah OCR expert untuk dokumen Kartu Keluarga (KK) Indonesia.
Ekstrak semua data dari gambar Kartu Keluarga ini dan kembalikan HANYA dalam format JSON berikut (tanpa markdown, tanpa kode block, tanpa penjelasan tambahan):
{
  "no_kk": "16 digit nomor KK",
  "kepala_keluarga": "nama kepala keluarga",
  "alamat": "alamat lengkap",
  "rt_rw": "RT/RW seperti 001/002",
  "kelurahan": "kelurahan/desa",
  "kecamatan": "kecamatan",
  "kabupaten": "kabupaten/kota",
  "provinsi": "provinsi",
  "anggota": [
    {
      "nama": "nama anggota",
      "nik": "16 digit NIK",
      "jenis_kelamin": "Laki-laki/Perempuan",
      "tempat_lahir": "tempat lahir",
      "tanggal_lahir": "tanggal lahir",
      "agama": "agama",
      "pendidikan": "pendidikan",
      "pekerjaan": "pekerjaan",
      "status_perkawinan": "status perkawinan",
      "hubungan_keluarga": "hubungan keluarga",
      "kewarganegaraan": "WNI/WNA"
    }
  ]
}
Jika ada data yang tidak terbaca, isi dengan string kosong "". Pastikan field anggota selalu berupa array.`
              },
              {
                inline_data: {
                  mime_type: imageMimeType,
                  data: imageData,
                }
              }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      }
    );

    console.log("Gemini response status:", aiResponse.status);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `Gemini API error ${aiResponse.status}: ${errText.substring(0, 300)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    if (!Array.isArray(extractedData.anggota)) extractedData.anggota = [];

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
        anggota: extractedData.anggota,
        status: "scanned",
      })
      .eq("id", recordId);

    if (updateError) throw new Error("DB update error: " + updateError.message);

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("scan-kk error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
