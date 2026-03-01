-- Create activity_logs table for tracking user actions
CREATE TABLE public.activity_logs (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,           -- 'upload', 'delete', 'scan', 'create', 'edit', 'import', 'export', 'login'
  entity_type TEXT NOT NULL,           -- 'arsip', 'kk', 'system'
  entity_id   TEXT,                    -- ID of the affected record (optional)
  entity_name TEXT,                    -- Human-readable name of entity
  description TEXT,                    -- Full description of the action
  metadata    JSONB DEFAULT '{}'::jsonb, -- Extra data (file size, count, etc.)
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own activity
CREATE POLICY "Users can view own activity_logs"
  ON public.activity_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own activity
CREATE POLICY "Users can insert own activity_logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for fast queries
CREATE INDEX idx_activity_logs_user_id    ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action     ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_entity     ON public.activity_logs(entity_type);
