import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
    Bell,
    Upload,
    Trash2,
    FileSearch,
    FilePlus,
    Pencil,
    FileSpreadsheet,
    Download,
    LogIn,
    CheckCheck,
    X,
    History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";

// ─── Action Config ───
const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    upload: { label: "Upload", icon: Upload, color: "bg-blue-500/15 text-blue-500" },
    create: { label: "Tambah", icon: FilePlus, color: "bg-green-500/15 text-green-600" },
    edit: { label: "Edit", icon: Pencil, color: "bg-amber-500/15 text-amber-500" },
    delete: { label: "Hapus", icon: Trash2, color: "bg-red-500/15 text-red-500" },
    scan: { label: "Scan KK", icon: FileSearch, color: "bg-purple-500/15 text-purple-500" },
    import: { label: "Import", icon: FileSpreadsheet, color: "bg-teal-500/15 text-teal-600" },
    export: { label: "Export", icon: Download, color: "bg-indigo-500/15 text-indigo-500" },
    login: { label: "Login", icon: LogIn, color: "bg-gray-500/15 text-gray-500" },
};

const ENTITY_PATH: Record<string, string> = {
    arsip: "/dashboard/arsip",
    kk: "/dashboard/berkas-kk",
    system: "/dashboard",
};

const LS_KEY = (uid: string) => `notif_read_at_${uid}`;

interface Notif {
    id: string;
    action: string;
    entity_type: string;
    description: string;
    created_at: string;
}

interface Props {
    collapsed?: boolean;
}

export const NotificationBell = ({ collapsed = false }: Props) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const dropRef = useRef<HTMLDivElement>(null);

    const [open, setOpen] = useState(false);
    const [notifs, setNotifs] = useState<Notif[]>([]);
    const [readAt, setReadAt] = useState<string>(() =>
        user ? localStorage.getItem(LS_KEY(user.id)) ?? new Date(0).toISOString() : new Date(0).toISOString()
    );
    const [popAnim, setPopAnim] = useState(false); // bell ring animation

    // ── Fetch recent notifications ──
    const fetchNotifs = async () => {
        if (!user) return;
        const { data } = await (supabase as any)
            .from("activity_logs")
            .select("id, action, entity_type, description, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(30);
        if (data) setNotifs(data);
    };

    useEffect(() => { fetchNotifs(); }, [user]);

    // ── Supabase Realtime subscription ──
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`notif:${user.id}`)
            .on(
                "postgres_changes" as any,
                {
                    event: "INSERT",
                    schema: "public",
                    table: "activity_logs",
                    filter: `user_id=eq.${user.id}`,
                },
                (payload: any) => {
                    setNotifs((prev) => [payload.new, ...prev].slice(0, 30));
                    // Bell ring animation
                    setPopAnim(true);
                    setTimeout(() => setPopAnim(false), 1000);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

    // ── Click outside to close ──
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // ── Unread count ──
    const unreadCount = notifs.filter((n) => n.created_at > readAt).length;

    // ── Mark all read ──
    const markAllRead = () => {
        const now = new Date().toISOString();
        setReadAt(now);
        if (user) localStorage.setItem(LS_KEY(user.id), now);
    };

    const handleOpen = () => {
        setOpen((o) => !o);
    };

    const handleClickNotif = (notif: Notif) => {
        navigate(ENTITY_PATH[notif.entity_type] ?? "/dashboard");
        setOpen(false);
    };

    return (
        <div className="relative" ref={dropRef}>
            {/* Bell Button */}
            <button
                onClick={handleOpen}
                title="Notifikasi"
                className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    open
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
            >
                <div className="relative shrink-0">
                    <Bell className={cn("h-5 w-5 transition-transform", popAnim && "animate-[ring_0.6s_ease-in-out]")} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </div>
                {!collapsed && <span>Notifikasi</span>}
                {!collapsed && unreadCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    className={cn(
                        "absolute z-50 bottom-full left-0 mb-2 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden",
                        "animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
                        collapsed ? "w-72" : "w-80"
                    )}
                    style={{ minWidth: "280px" }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                        <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-sm text-foreground">Notifikasi</span>
                            {unreadCount > 0 && (
                                <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                    {unreadCount} baru
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    title="Tandai semua dibaca"
                                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                >
                                    <CheckCheck className="h-3.5 w-3.5" />
                                </button>
                            )}
                            <button
                                onClick={() => { navigate("/dashboard/riwayat"); setOpen(false); }}
                                title="Lihat semua riwayat"
                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                                <History className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto overscroll-contain">
                        {notifs.length === 0 ? (
                            <div className="py-10 text-center">
                                <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Belum ada notifikasi</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {notifs.map((notif) => {
                                    const cfg = ACTION_CONFIG[notif.action] ?? ACTION_CONFIG["login"];
                                    const Icon = cfg.icon;
                                    const isUnread = notif.created_at > readAt;

                                    return (
                                        <button
                                            key={notif.id}
                                            onClick={() => handleClickNotif(notif)}
                                            className={cn(
                                                "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors",
                                                isUnread && "bg-primary/5 hover:bg-primary/10"
                                            )}
                                        >
                                            {/* Icon */}
                                            <div className={cn("p-1.5 rounded-lg shrink-0 mt-0.5", cfg.color)}>
                                                <Icon className="h-3.5 w-3.5" />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className={cn(
                                                    "text-xs leading-snug line-clamp-2",
                                                    isUnread ? "text-foreground font-medium" : "text-muted-foreground"
                                                )}>
                                                    {notif.description}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: localeId })}
                                                </p>
                                            </div>

                                            {/* Unread dot */}
                                            {isUnread && (
                                                <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifs.length > 0 && (
                        <div className="border-t border-border p-2">
                            <button
                                onClick={() => { navigate("/dashboard/riwayat"); setOpen(false); }}
                                className="w-full text-center text-xs text-primary hover:text-primary/80 py-1.5 rounded-lg hover:bg-primary/5 transition-colors font-medium"
                            >
                                Lihat semua riwayat aktivitas →
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
