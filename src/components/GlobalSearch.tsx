import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
    Search,
    FileText,
    FolderOpen,
    Users,
    X,
    ArrowRight,
    Loader2,
    CreditCard,
    Clock,
    Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface SearchResult {
    id: string;
    type: "arsip" | "kk";
    title: string;
    subtitle: string;
    badge?: string;
    badgeVariant?: "default" | "secondary" | "outline" | "destructive";
    path: string;
    date?: string;
    meta?: string;
}

interface GlobalSearchProps {
    open: boolean;
    onClose: () => void;
}

const useDebounce = (value: string, delay = 300) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
};

const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" => {
    if (s === "Aktif" || s === "scanned") return "default";
    if (s === "Review") return "secondary";
    if (s === "pending") return "outline";
    if (s === "Arsip") return "destructive";
    return "outline";
};

export const GlobalSearch = ({ open, onClose }: GlobalSearchProps) => {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(0);

    const debouncedQuery = useDebounce(query, 280);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 60);
            setQuery("");
            setResults([]);
            setFocused(0);
        }
    }, [open]);

    // Search
    useEffect(() => {
        if (!debouncedQuery.trim()) { setResults([]); return; }

        const q = debouncedQuery.trim();
        setLoading(true);

        const run = async () => {
            const [{ data: arsipData }, { data: kkData }] = await Promise.all([
                supabase
                    .from("archives")
                    .select("id, title, category, status, created_at, description")
                    .or(`title.ilike.%${q}%,category.ilike.%${q}%,description.ilike.%${q}%`)
                    .limit(6),
                supabase
                    .from("kk_records")
                    .select("id, no_kk, kepala_keluarga, status, created_at, alamat")
                    .or(`no_kk.ilike.%${q}%,kepala_keluarga.ilike.%${q}%,alamat.ilike.%${q}%`)
                    .limit(6),
            ]);

            const arsipResults: SearchResult[] = (arsipData ?? []).map((a) => ({
                id: a.id,
                type: "arsip",
                title: a.title,
                subtitle: a.category ?? "Tidak ada kategori",
                badge: a.status,
                badgeVariant: statusVariant(a.status),
                path: "/dashboard/arsip",
                date: a.created_at,
                meta: a.description ?? "",
            }));

            const kkResults: SearchResult[] = (kkData ?? []).map((k) => ({
                id: k.id,
                type: "kk",
                title: k.kepala_keluarga ?? "Belum discan",
                subtitle: k.no_kk ? `No. KK: ${k.no_kk}` : "Nomor KK belum tersedia",
                badge: k.status === "scanned" ? "Selesai" : "Pending",
                badgeVariant: statusVariant(k.status),
                path: "/dashboard/berkas-kk",
                date: k.created_at,
                meta: k.alamat ?? "",
            }));

            setResults([...arsipResults, ...kkResults]);
            setFocused(0);
            setLoading(false);
        };

        run().catch(() => setLoading(false));
    }, [debouncedQuery]);

    // Keyboard navigation
    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setFocused((f) => Math.min(f + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setFocused((f) => Math.max(f - 1, 0));
            } else if (e.key === "Enter" && results[focused]) {
                navigate(results[focused].path);
                onClose();
            } else if (e.key === "Escape") {
                onClose();
            }
        },
        [results, focused, navigate, onClose]
    );

    // Scroll focused item into view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${focused}"]`);
        el?.scrollIntoView({ block: "nearest" });
    }, [focused]);

    if (!open) return null;

    const arsipResults = results.filter((r) => r.type === "arsip");
    const kkResults = results.filter((r) => r.type === "kk");
    const hasResults = results.length > 0;
    const showEmpty = !loading && debouncedQuery && !hasResults;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-150"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="fixed top-[12%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-in fade-in-0 zoom-in-95 slide-in-from-top-4 duration-200">
                <div className="bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden">

                    {/* Search input */}
                    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
                        {loading
                            ? <Loader2 className="h-5 w-5 text-muted-foreground shrink-0 animate-spin" />
                            : <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                        }
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="Cari arsip, berkas KK, kepala keluarga..."
                            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none"
                        />
                        {query && (
                            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                        <kbd className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                            ESC
                        </kbd>
                    </div>

                    {/* Results */}
                    <div ref={listRef} className="max-h-[420px] overflow-y-auto overscroll-contain">

                        {/* Default state */}
                        {!query && (
                            <div className="p-6 text-center">
                                <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Ketik untuk mencari arsip atau berkas KK</p>
                                <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground/60">
                                    <span className="flex items-center gap-1.5">
                                        <FolderOpen className="h-3.5 w-3.5" /> Arsip
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <CreditCard className="h-3.5 w-3.5" /> Berkas KK
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Empty */}
                        {showEmpty && (
                            <div className="p-8 text-center">
                                <p className="text-sm font-medium text-foreground mb-1">Tidak ada hasil</p>
                                <p className="text-xs text-muted-foreground">
                                    Tidak ditemukan hasil untuk <span className="font-semibold">"{debouncedQuery}"</span>
                                </p>
                            </div>
                        )}

                        {/* Results grouped */}
                        {hasResults && (
                            <div className="py-2">

                                {/* Arsip group */}
                                {arsipResults.length > 0 && (
                                    <>
                                        <div className="px-4 py-1.5 flex items-center gap-2">
                                            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                Arsip ({arsipResults.length})
                                            </span>
                                        </div>
                                        {arsipResults.map((result) => {
                                            const idx = results.indexOf(result);
                                            return (
                                                <ResultItem
                                                    key={result.id}
                                                    result={result}
                                                    idx={idx}
                                                    focused={focused === idx}
                                                    onHover={() => setFocused(idx)}
                                                    onClick={() => { navigate(result.path); onClose(); }}
                                                />
                                            );
                                        })}
                                    </>
                                )}

                                {/* KK group */}
                                {kkResults.length > 0 && (
                                    <>
                                        <div className={cn("px-4 py-1.5 flex items-center gap-2", arsipResults.length > 0 && "mt-1 border-t border-border pt-2")}>
                                            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                Berkas KK ({kkResults.length})
                                            </span>
                                        </div>
                                        {kkResults.map((result) => {
                                            const idx = results.indexOf(result);
                                            return (
                                                <ResultItem
                                                    key={result.id}
                                                    result={result}
                                                    idx={idx}
                                                    focused={focused === idx}
                                                    onHover={() => setFocused(idx)}
                                                    onClick={() => { navigate(result.path); onClose(); }}
                                                />
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border px-4 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <kbd className="bg-muted px-1.5 py-0.5 rounded font-mono">↑↓</kbd> navigasi
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="bg-muted px-1.5 py-0.5 rounded font-mono">↵</kbd> pilih
                            </span>
                        </div>
                        {hasResults && (
                            <span>{results.length} hasil ditemukan</span>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

// ─── Result Item ───
const ResultItem = ({
    result, idx, focused, onHover, onClick,
}: {
    result: SearchResult;
    idx: number;
    focused: boolean;
    onHover: () => void;
    onClick: () => void;
}) => {
    const Icon = result.type === "arsip" ? FileText : Users;

    return (
        <button
            data-idx={idx}
            onMouseEnter={onHover}
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group",
                focused ? "bg-accent/60" : "hover:bg-muted/60"
            )}
        >
            {/* Icon */}
            <div className={cn(
                "p-1.5 rounded-md shrink-0 transition-colors",
                result.type === "arsip"
                    ? focused ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    : focused ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"
            )}>
                <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                    <Badge variant={result.badgeVariant ?? "outline"} className="text-[10px] py-0 h-4 shrink-0">
                        {result.badge}
                    </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Tag className="h-3 w-3 shrink-0" />
                        {result.subtitle}
                    </span>
                    {result.date && (
                        <span className="text-xs text-muted-foreground/60 flex items-center gap-1 shrink-0 hidden sm:flex">
                            <Clock className="h-3 w-3" />
                            {format(new Date(result.date), "dd MMM yyyy", { locale: localeId })}
                        </span>
                    )}
                </div>
                {result.meta && (
                    <p className="text-xs text-muted-foreground/50 truncate mt-0.5">{result.meta}</p>
                )}
            </div>

            {/* Arrow */}
            <ArrowRight className={cn(
                "h-4 w-4 shrink-0 transition-all",
                focused ? "text-foreground translate-x-0.5" : "text-muted-foreground/30"
            )} />
        </button>
    );
};

export default GlobalSearch;
