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

    // Call Google Gemini API with image for OCR
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
                  text: `Kamu adalah OCR expert untuk dokumen Kartu Keluarga (KK) Indonesia.
Ekstrak semua data dari gambar Kartu Keluarga ini dan kembalikan HANYA dalam format JSON berikut (tanpa markdown, tanpa kode block):
{
  "no_kk": "16 digit nomor KK",
  "kepala_keluarga": "nama kepala keluarga",
  "alamat": "alamat lengkap",
  "rt_rw": "RT/RW",
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
Jika ada data yang tidak terbaca, isi dengan string kosong "". Pastikan field anggota selalu berupa array.`,
                },
                {
                  inline_data: null,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    // Kalau imageUrl adalah URL publik, gunakan file_data; jika tidak, download dulu
    let imageData: string;
    let imageMimeType: string = "image/jpeg";

    // Download gambar dan convert ke base64
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) throw new Error("Gagal mengunduh gambar");
    const imgBuffer = await imgResponse.arrayBuffer();
    const imgBytes = new Uint8Array(imgBuffer);
    imageData = btoa(String.fromCharCode(...imgBytes));

    // Detect mime type dari URL
    if (imageUrl.toLowerCase().includes(".png")) imageMimeType = "image/png";
    else if (imageUrl.toLowerCase().includes(".webp")) imageMimeType = "image/webp";
    else if (imageUrl.toLowerCase().includes(".jpg") || imageUrl.toLowerCase().includes(".jpeg")) imageMimeType = "image/jpeg";

    // Re-build request dengan data gambar
    const finalAiResponse = await fetch(
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
                  text: `Kamu adalah OCR expert untuk dokumen Kartu Keluarga (KK) Indonesia.
Ekstrak semua data dari gambar Kartu Keluarga ini dan kembalikan HANYA dalam format JSON berikut (tanpa markdown, tanpa kode block, tanpa penjelasan tambahan):
{
  "no_kk": "16 digit nomor KK",
  "kepala_keluarga": "nama kepala keluarga",
  "alamat": "alamat lengkap",
  "rt_rw": "RT/RW",
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
}`,
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
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!finalAiResponse.ok) {
      const errText = await finalAiResponse.text();
      console.error("Gemini AI error:", finalAiResponse.status, errText);

      if (finalAiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Terlalu banyak permintaan, coba lagi nanti." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Gemini API error: ${finalAiResponse.status} - ${errText}`);
    }

    const aiData = await finalAiResponse.json();
    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("AI tidak mengembalikan data");
    }

    // Parse JSON dari respons AI (hapus markdown jika ada)
    let extractedData: any;
    try {
      // Bersihkan jika ada markdown code block
      const cleaned = rawText
        .replace(/```json\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();
      extractedData = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse AI response:", rawText);
      throw new Error("Gagal memproses respons AI: format tidak valid");
    }

    // Pastikan anggota adalah array
    if (!Array.isArray(extractedData.anggota)) {
      extractedData.anggota = [];
    }

    // Update the record in the database
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

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
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
