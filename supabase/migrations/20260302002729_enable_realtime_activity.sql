-- Enable Supabase Realtime for activity_logs table
-- Run this in Supabase SQL Editor

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
