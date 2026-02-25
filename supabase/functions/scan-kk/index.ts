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
              content: `Kamu adalah OCR expert untuk dokumen Kartu Keluarga (KK) Indonesia. Ekstrak data dari gambar KK yang diberikan. Gunakan tool yang disediakan untuk mengembalikan data terstruktur.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Ekstrak semua data dari gambar Kartu Keluarga ini. Pastikan semua field terisi seakurat mungkin.",
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
                name: "extract_kk_data",
                description:
                  "Extract structured data from a Kartu Keluarga document",
                parameters: {
                  type: "object",
                  properties: {
                    no_kk: {
                      type: "string",
                      description: "Nomor Kartu Keluarga (16 digit)",
                    },
                    kepala_keluarga: {
                      type: "string",
                      description: "Nama Kepala Keluarga",
                    },
                    alamat: { type: "string", description: "Alamat lengkap" },
                    rt_rw: { type: "string", description: "RT/RW" },
                    kelurahan: {
                      type: "string",
                      description: "Kelurahan/Desa",
                    },
                    kecamatan: { type: "string", description: "Kecamatan" },
                    kabupaten: {
                      type: "string",
                      description: "Kabupaten/Kota",
                    },
                    provinsi: { type: "string", description: "Provinsi" },
                    anggota: {
                      type: "array",
                      description: "Daftar anggota keluarga",
                      items: {
                        type: "object",
                        properties: {
                          nama: { type: "string" },
                          nik: { type: "string" },
                          jenis_kelamin: { type: "string" },
                          tempat_lahir: { type: "string" },
                          tanggal_lahir: { type: "string" },
                          agama: { type: "string" },
                          pendidikan: { type: "string" },
                          pekerjaan: { type: "string" },
                          status_perkawinan: { type: "string" },
                          hubungan_keluarga: { type: "string" },
                          kewarganegaraan: { type: "string" },
                        },
                        required: ["nama", "nik", "hubungan_keluarga"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["no_kk", "kepala_keluarga", "anggota"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_kk_data" },
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
