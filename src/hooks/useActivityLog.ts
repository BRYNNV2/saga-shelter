import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

export type ActivityAction =
    | "upload"
    | "delete"
    | "scan"
    | "create"
    | "edit"
    | "import"
    | "export"
    | "login";

export type EntityType = "arsip" | "kk" | "system";

interface LogParams {
    action: ActivityAction;
    entityType: EntityType;
    entityId?: string;
    entityName?: string;
    description: string;
    metadata?: Record<string, any>;
}

/**
 * Hook untuk mencatat aktivitas user ke tabel activity_logs.
 * Dipanggil setelah aksi berhasil (fire-and-forget, tidak throw error).
 */
export const useActivityLog = () => {
    const { user } = useAuth();

    const log = useCallback(
        async (params: LogParams) => {
            if (!user) return;
            try {
                await supabase.from("activity_logs" as any).insert({
                    user_id: user.id,
                    action: params.action,
                    entity_type: params.entityType,
                    entity_id: params.entityId ?? null,
                    entity_name: params.entityName ?? null,
                    description: params.description,
                    metadata: params.metadata ?? {},
                });
            } catch {
                // Logging is non-critical — silently ignore errors
            }
        },
        [user]
    );

    return { log };
};
