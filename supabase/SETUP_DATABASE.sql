-- ============================================================
--  SAGA SHELTER — FULL DATABASE SETUP
--  Jalankan file ini SEKALI di Supabase Dashboard > SQL Editor
--  Tanggal: 2026-03-02
-- ============================================================

-- ─────────────────────────────────────────
-- 1. TABEL PROFILES (data user tambahan)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username  TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile saat user baru daftar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────
-- 2. FUNGSI UPDATE TIMESTAMP OTOMATIS
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- ─────────────────────────────────────────
-- 3. TABEL ARCHIVES (dokumen arsip)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.archives (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'Umum',
  file_ref    TEXT,
  status      TEXT NOT NULL DEFAULT 'Aktif',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own archives" ON public.archives;
CREATE POLICY "Users can view own archives"
  ON public.archives FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own archives" ON public.archives;
CREATE POLICY "Users can insert own archives"
  ON public.archives FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own archives" ON public.archives;
CREATE POLICY "Users can update own archives"
  ON public.archives FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own archives" ON public.archives;
CREATE POLICY "Users can delete own archives"
  ON public.archives FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_archives_updated_at ON public.archives;
CREATE TRIGGER update_archives_updated_at
  BEFORE UPDATE ON public.archives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────
-- 4. STORAGE BUCKET (upload file)
-- ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Hapus policy lama jika ada, lalu buat yang baru
DROP POLICY IF EXISTS "Users can upload documents"   ON storage.objects;
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

CREATE POLICY "Users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ─────────────────────────────────────────
-- 5. TABEL KK_RECORDS (data Kartu Keluarga)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kk_records (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url        TEXT NOT NULL DEFAULT '',
  no_kk            TEXT,
  kepala_keluarga  TEXT,
  alamat           TEXT,
  rt_rw            TEXT,
  kelurahan        TEXT,
  kecamatan        TEXT,
  kabupaten        TEXT,
  provinsi         TEXT,
  anggota          JSONB DEFAULT '[]'::jsonb,
  raw_text         TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kk_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own kk_records" ON public.kk_records;
CREATE POLICY "Users can view own kk_records"
  ON public.kk_records FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own kk_records" ON public.kk_records;
CREATE POLICY "Users can insert own kk_records"
  ON public.kk_records FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own kk_records" ON public.kk_records;
CREATE POLICY "Users can update own kk_records"
  ON public.kk_records FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own kk_records" ON public.kk_records;
CREATE POLICY "Users can delete own kk_records"
  ON public.kk_records FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_kk_records_updated_at ON public.kk_records;
CREATE TRIGGER update_kk_records_updated_at
  BEFORE UPDATE ON public.kk_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────
-- X. TABEL KTP_RECORDS (data Kartu Tanda Penduduk)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ktp_records (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url        TEXT NOT NULL DEFAULT '',
  nik              TEXT,
  nama             TEXT,
  tempat_lahir     TEXT,
  tanggal_lahir    TEXT,
  jenis_kelamin    TEXT,
  golongan_darah   TEXT,
  alamat           TEXT,
  rt_rw            TEXT,
  kelurahan        TEXT,
  kecamatan        TEXT,
  agama            TEXT,
  status_perkawinan TEXT,
  pekerjaan        TEXT,
  kewarganegaraan  TEXT,
  raw_text         TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ktp_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ktp_records" ON public.ktp_records;
CREATE POLICY "Users can view own ktp_records"
  ON public.ktp_records FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own ktp_records" ON public.ktp_records;
CREATE POLICY "Users can insert own ktp_records"
  ON public.ktp_records FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own ktp_records" ON public.ktp_records;
CREATE POLICY "Users can update own ktp_records"
  ON public.ktp_records FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own ktp_records" ON public.ktp_records;
CREATE POLICY "Users can delete own ktp_records"
  ON public.ktp_records FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_ktp_records_updated_at ON public.ktp_records;
CREATE TRIGGER update_ktp_records_updated_at
  BEFORE UPDATE ON public.ktp_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────
-- 6. TABEL ACTIVITY_LOGS (riwayat aktivitas)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  entity_name TEXT,
  description TEXT,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own activity_logs" ON public.activity_logs;
CREATE POLICY "Users can view own activity_logs"
  ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own activity_logs" ON public.activity_logs;
CREATE POLICY "Users can insert own activity_logs"
  ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id    ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action     ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity     ON public.activity_logs(entity_type);


-- ─────────────────────────────────────────
-- 7. AKTIFKAN REALTIME (notifikasi live)
-- ─────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ─────────────────────────────────────────
-- SELESAI ✅
-- ─────────────────────────────────────────
-- Tabel yang dibuat:
--   ✅ profiles
--   ✅ archives
--   ✅ kk_records
--   ✅ activity_logs
-- Storage:
--   ✅ bucket "documents" (public)
-- Realtime:
--   ✅ activity_logs
-- ─────────────────────────────────────────
