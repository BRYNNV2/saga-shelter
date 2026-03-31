/* eslint-disable */
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, recordId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call AI with image for OCR
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Kamu adalah OCR expert untuk dokumen Kartu Tanda Penduduk (KTP) Indonesia. Ekstrak data dari gambar KTP yang diberikan. Gunakan tool yang disediakan untuk mengembalikan data terstruktur secara presisi tanpa tambahan teks.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Ekstrak semua data inti dari gambar Kartu Tanda Penduduk ini secara lengkap. Pastikan NIK, Nama, Tanggal Lahir hingga Pekerjaan terisi dengan akurat sesuai di gambar.",
                },
                {
                  type: "image_url",
                  image_url: { url: imageUrl },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_ktp_data",
                description:
                  "Extract structured data from a Kartu Tanda Penduduk document",
                parameters: {
                  type: "object",
                  properties: {
                    nik: { type: "string", description: "Nomor Induk Kependudukan (16 digit)" },
                    nama: { type: "string", description: "Nama Lengkap" },
                    tempat_lahir: { type: "string", description: "Tempat Lahir" },
                    tanggal_lahir: { type: "string", description: "Tanggal Lahir format DD-MM-YYYY" },
                    jenis_kelamin: { type: "string", description: "LAKI-LAKI atau PEREMPUAN" },
                    golongan_darah: { type: "string", description: "A, B, AB, O, atau -" },
                    alamat: { type: "string", description: "Alamat tempat tinggal" },
                    rt_rw: { type: "string", description: "RT/RW" },
                    kelurahan: { type: "string", description: "Kel/Desa" },
                    kecamatan: { type: "string", description: "Kecamatan" },
                    agama: { type: "string", description: "Agama" },
                    status_perkawinan: { type: "string", description: "Status Perkawinan" },
                    pekerjaan: { type: "string", description: "Pekerjaan" },
                    kewarganegaraan: { type: "string", description: "WNI atau WNA" },
                  },
                  required: ["nik", "nama"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_ktp_data" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Terlalu banyak permintaan, coba lagi nanti." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Kredit AI habis, silakan tambah kredit." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("AI did not return structured data");
    }

    const extractedData = JSON.parse(toolCall.function.arguments);

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
