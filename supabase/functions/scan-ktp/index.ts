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

    const models = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-pro-vision"
    ];

    let aiResponse;
    let lastError = "";

    for (const model of models) {
      console.log(`Trying model: ${model}`);
      aiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: `Kamu adalah OCR expert untuk dokumen Kartu Tanda Penduduk (KTP) Indonesia.
Ekstrak semua data dari gambar KTP ini dan kembalikan HANYA dalam format JSON berikut:
{
  "nik": "16 digit NIK",
  "nama": "nama lengkap",
  "tempat_lahir": "tempat lahir",
  "tanggal_lahir": "tanggal lahir DD-MM-YYYY",
  "jenis_kelamin": "LAKI-LAKI/PEREMPUAN",
  "golongan_darah": "A/B/AB/O/-",
  "alamat": "alamat lengkap",
  "rt_rw": "RT/RW",
  "kelurahan": "kelurahan",
  "kecamatan": "kecamatan",
  "agama": "agama",
  "status_perkawinan": "status",
  "pekerjaan": "pekerjaan",
  "kewarganegaraan": "WNI"
}`
                },
                {
                  inline_data: {
                    mime_type: imageMimeType,
                    data: imageData,
                  }
                }
              ]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
          }),
        }
      );

      if (aiResponse.ok) break;

      const errText = await aiResponse.text();
      lastError = `${model}: ${aiResponse.status} ${errText.substring(0, 50)}`;
      console.warn(`Model ${model} failed:`, lastError);
      
      if (aiResponse.status !== 429 && aiResponse.status !== 404) break;
    }

    if (!aiResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Semua model AI sedang sibuk (Quota Limit). Mohon tunggu 5-10 menit. (${lastError})` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("AI tidak mengembalikan teks");

    let extractedData: any;
    try {
      const cleaned = rawText.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
      extractedData = JSON.parse(cleaned);
    } catch {
      throw new Error("Gagal parse data dari AI");
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

    if (updateError) throw new Error("Gagal update database");

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
