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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download gambar dan convert ke base64
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) throw new Error("Gagal mengunduh gambar");
    const imgBuffer = await imgResponse.arrayBuffer();
    const imgBytes = new Uint8Array(imgBuffer);
    const imageData = btoa(String.fromCharCode(...imgBytes));

    // Detect mime type dari URL
    let imageMimeType = "image/jpeg";
    if (imageUrl.toLowerCase().includes(".png")) imageMimeType = "image/png";
    else if (imageUrl.toLowerCase().includes(".webp")) imageMimeType = "image/webp";

    // Call Google Gemini API
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
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
Jika ada data yang tidak terbaca, isi dengan string kosong "".`,
                },
                {
                  inline_data: {
                    mime_type: imageMimeType,
                    data: imageData,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini AI error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Terlalu banyak permintaan, coba lagi nanti." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Gemini API error: ${aiResponse.status} - ${errText}`);
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("AI tidak mengembalikan data");
    }

    // Parse JSON dari respons AI
    let extractedData: any;
    try {
      const cleaned = rawText
        .replace(/```json\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();
      extractedData = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse AI response:", rawText);
      throw new Error("Gagal memproses respons AI: format tidak valid");
    }

    // Update the record in the database
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

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
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
