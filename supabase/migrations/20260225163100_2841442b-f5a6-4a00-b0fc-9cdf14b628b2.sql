
-- Create storage bucket for document uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to view their own documents
CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own documents
CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create table for KK (Kartu Keluarga) scanned data
CREATE TABLE public.kk_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  no_kk TEXT,
  kepala_keluarga TEXT,
  alamat TEXT,
  rt_rw TEXT,
  kelurahan TEXT,
  kecamatan TEXT,
  kabupaten TEXT,
  provinsi TEXT,
  anggota JSONB DEFAULT '[]'::jsonb,
  raw_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kk_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own kk_records" ON public.kk_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own kk_records" ON public.kk_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own kk_records" ON public.kk_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own kk_records" ON public.kk_records FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_kk_records_updated_at
BEFORE UPDATE ON public.kk_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
