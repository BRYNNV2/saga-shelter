import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import {
    Settings,
    User,
    Lock,
    Bell,
    Palette,
    Shield,
    Save,
    Loader2,
    Eye,
    EyeOff,
    CheckCircle2,
    Mail,
    Calendar,
    KeyRound,
    LogOut,
    Trash2,
    ChevronRight,
    Info,
    Tag,
    Plus,
    X,
    RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/useCategories";

type TabKey = "profil" | "keamanan" | "notifikasi" | "kategori" | "tentang";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "profil", label: "Profil", icon: User },
    { key: "keamanan", label: "Keamanan", icon: Shield },
    { key: "notifikasi", label: "Notifikasi", icon: Bell },
    { key: "kategori", label: "Kategori", icon: Tag }, // Added Kategori tab
    { key: "tentang", label: "Tentang", icon: Info },
];

const Pengaturan = () => {
    const { user, signOut } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<TabKey>("profil");

    // ──── Profil state ────
    const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
    const [savingProfile, setSavingProfile] = useState(false);

    // ──── Password state ────
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);

    // ──── Notifikasi state ────
    const [notifUpload, setNotifUpload] = useState(true);
    const [notifScan, setNotifScan] = useState(true);
    const [notifSystem, setNotifSystem] = useState(false);

    // ──── Logout / Delete dialogs ────
    const [showLogoutDialog, setShowLogoutDialog] = useState(false);

    // ──── Kategori ────
    const { categories, addCategory, renameCategory, deleteCategory, resetToDefault } = useCategories();
    const [newCatInput, setNewCatInput] = useState("");
    const [editingCat, setEditingCat] = useState<string | null>(null);
    const [editingCatValue, setEditingCatValue] = useState("");

    // Sync name from auth
    useEffect(() => {
        setFullName(user?.user_metadata?.full_name || "");
    }, [user]);

    // ──── Handlers ────
    const handleSaveProfile = async () => {
        if (!fullName.trim()) {
            toast({ title: "Nama tidak boleh kosong", variant: "destructive" });
            return;
        }
        setSavingProfile(true);
        const { error } = await supabase.auth.updateUser({
            data: { full_name: fullName.trim() },
        });
        setSavingProfile(false);
        if (error) {
            toast({ title: "Gagal menyimpan profil", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Profil berhasil diperbarui" });
        }
    };

    const handleChangePassword = async () => {
        if (!newPassword || !confirmPassword) {
            toast({ title: "Isi semua kolom password", variant: "destructive" });
            return;
        }
        if (newPassword.length < 6) {
            toast({ title: "Password minimal 6 karakter", variant: "destructive" });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: "Konfirmasi password tidak cocok", variant: "destructive" });
            return;
        }
        setSavingPassword(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setSavingPassword(false);
        if (error) {
            toast({ title: "Gagal ubah password", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Password berhasil diubah" });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate("/login");
    };

    const displayEmail = user?.email ?? "—";
    const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
    const joinedAt = user?.created_at
        ? format(new Date(user.created_at), "dd MMMM yyyy", { locale: localeId })
        : "—";
    const lastSignIn = user?.last_sign_in_at
        ? format(new Date(user.last_sign_in_at), "dd MMM yyyy, HH:mm", { locale: localeId })
        : "—";

    // ──── Password strength ────
    const passwordStrength = (pw: string) => {
        if (!pw) return { score: 0, label: "", color: "" };
        let score = 0;
        if (pw.length >= 6) score++;
        if (pw.length >= 10) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        if (score <= 1) return { score, label: "Sangat Lemah", color: "bg-destructive" };
        if (score === 2) return { score, label: "Lemah", color: "bg-orange-400" };
        if (score === 3) return { score, label: "Sedang", color: "bg-yellow-400" };
        if (score === 4) return { score, label: "Kuat", color: "bg-blue-500" };
        return { score, label: "Sangat Kuat", color: "bg-success" };
    };

    const pwStrength = passwordStrength(newPassword);

    return (
        <div className="flex min-h-screen bg-background">
            <DashboardSidebar />

            <main className="flex-1 overflow-auto">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4">
                    <div className="flex items-center gap-3">
                        <Settings className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Pengaturan</h1>
                            <p className="text-sm text-muted-foreground">Kelola akun dan preferensi aplikasi</p>
                        </div>
                    </div>
                </header>

                <div className="p-6">
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-6">

                        {/* ── Sidebar Tabs ── */}
                        <nav className="md:w-52 shrink-0">
                            <div className="glass-card rounded-xl p-2 flex flex-row md:flex-col gap-1">
                                {TABS.map((tab) => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={cn(
                                            "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full text-left",
                                            activeTab === tab.key
                                                ? "bg-primary text-primary-foreground shadow-sm"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        <tab.icon className="h-4 w-4 shrink-0" />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                    </button>
                                ))}

                                <Separator className="my-1 hidden md:block" />

                                {/* Logout shortcut */}
                                <button
                                    onClick={() => setShowLogoutDialog(true)}
                                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full text-left text-destructive hover:bg-destructive/10 hidden md:flex"
                                >
                                    <LogOut className="h-4 w-4 shrink-0" />
                                    <span>Keluar</span>
                                </button>
                            </div>
                        </nav>

                        {/* ── Content ── */}
                        <div className="flex-1 space-y-5">

                            {/* ━━ PROFIL TAB ━━ */}
                            {activeTab === "profil" && (
                                <>
                                    {/* Avatar / Info card */}
                                    <div className="glass-card rounded-xl p-6">
                                        <div className="flex items-center gap-5 mb-6">
                                            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-2xl font-bold shrink-0 select-none">
                                                {displayName[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-lg font-semibold text-foreground">{displayName}</p>
                                                <p className="text-sm text-muted-foreground">{displayEmail}</p>
                                                <Badge variant="default" className="mt-1.5 text-xs">Pengguna Aktif</Badge>
                                            </div>
                                        </div>

                                        {/* Info grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-sm">
                                            {[
                                                { icon: Mail, label: "Email", value: displayEmail },
                                                { icon: Calendar, label: "Bergabung", value: joinedAt },
                                                { icon: CheckCircle2, label: "Login Terakhir", value: lastSignIn },
                                            ].map((item) => (
                                                <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                                                    <item.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                                                        <p className="font-medium text-foreground break-all">{item.value}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <Separator className="mb-5" />

                                        {/* Edit form */}
                                        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                                            <User className="h-4 w-4" /> Edit Profil
                                        </h3>

                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="full-name">Nama Lengkap</Label>
                                                <Input
                                                    id="full-name"
                                                    placeholder="Masukkan nama lengkap"
                                                    value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    className="mt-1"
                                                />
                                            </div>
                                            <div>
                                                <Label>Email</Label>
                                                <Input
                                                    value={displayEmail}
                                                    disabled
                                                    className="mt-1 opacity-60 cursor-not-allowed"
                                                />
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Email tidak dapat diubah langsung dari pengaturan.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex justify-end mt-5">
                                            <Button onClick={handleSaveProfile} disabled={savingProfile}>
                                                {savingProfile
                                                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    : <Save className="h-4 w-4 mr-2" />}
                                                Simpan Profil
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Danger zone */}
                                    <div className="glass-card rounded-xl p-6 border border-destructive/20">
                                        <h3 className="text-sm font-semibold text-destructive mb-4 flex items-center gap-2">
                                            <Shield className="h-4 w-4" /> Zona Berbahaya
                                        </h3>
                                        <div className="flex items-center justify-between py-3 border-t border-border">
                                            <div>
                                                <p className="font-medium text-foreground text-sm">Keluar dari Akun</p>
                                                <p className="text-xs text-muted-foreground">Sesi Anda akan diakhiri dan diarahkan ke halaman login.</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-destructive border-destructive/40 hover:bg-destructive/10 shrink-0"
                                                onClick={() => setShowLogoutDialog(true)}
                                            >
                                                <LogOut className="h-4 w-4 mr-2" /> Keluar
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ━━ KEAMANAN TAB ━━ */}
                            {activeTab === "keamanan" && (
                                <div className="glass-card rounded-xl p-6">
                                    <h3 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
                                        <KeyRound className="h-4 w-4 text-primary" /> Ubah Password
                                    </h3>

                                    <div className="space-y-4 max-w-md">
                                        {/* New password */}
                                        <div>
                                            <Label htmlFor="new-pw">Password Baru</Label>
                                            <div className="relative mt-1">
                                                <Input
                                                    id="new-pw"
                                                    type={showNew ? "text" : "password"}
                                                    placeholder="Masukkan password baru"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNew(!showNew)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            {/* Strength indicator */}
                                            {newPassword && (
                                                <div className="mt-2 space-y-1">
                                                    <div className="flex gap-1">
                                                        {[1, 2, 3, 4, 5].map((i) => (
                                                            <div
                                                                key={i}
                                                                className={cn(
                                                                    "h-1 flex-1 rounded-full transition-all",
                                                                    i <= pwStrength.score ? pwStrength.color : "bg-muted"
                                                                )}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Kekuatan: <span className="font-medium text-foreground">{pwStrength.label}</span>
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Confirm password */}
                                        <div>
                                            <Label htmlFor="confirm-pw">Konfirmasi Password Baru</Label>
                                            <div className="relative mt-1">
                                                <Input
                                                    id="confirm-pw"
                                                    type={showConfirm ? "text" : "password"}
                                                    placeholder="Ulangi password baru"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className={cn(
                                                        "pr-10",
                                                        confirmPassword && confirmPassword !== newPassword
                                                            ? "border-destructive focus-visible:ring-destructive"
                                                            : confirmPassword && confirmPassword === newPassword
                                                                ? "border-success focus-visible:ring-success"
                                                                : ""
                                                    )}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirm(!showConfirm)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            {confirmPassword && confirmPassword !== newPassword && (
                                                <p className="text-xs text-destructive mt-1">Password tidak cocok</p>
                                            )}
                                            {confirmPassword && confirmPassword === newPassword && (
                                                <p className="text-xs text-success mt-1 flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3" /> Password cocok
                                                </p>
                                            )}
                                        </div>

                                        <div className="pt-2">
                                            <Button onClick={handleChangePassword} disabled={savingPassword}>
                                                {savingPassword
                                                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    : <Lock className="h-4 w-4 mr-2" />}
                                                Ubah Password
                                            </Button>
                                        </div>
                                    </div>

                                    <Separator className="my-6" />

                                    {/* Security info */}
                                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-primary" /> Informasi Keamanan
                                    </h3>
                                    <div className="space-y-3">
                                        {[
                                            { label: "Login Terakhir", value: lastSignIn },
                                            { label: "ID Pengguna", value: user?.id?.slice(0, 16) + "..." ?? "—" },
                                            { label: "Provider Auth", value: user?.app_metadata?.provider ?? "email" },
                                        ].map((info) => (
                                            <div key={info.label} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                                                <span className="text-sm text-muted-foreground">{info.label}</span>
                                                <span className="text-sm font-medium text-foreground font-mono">{info.value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-5 p-4 rounded-lg bg-muted/40 text-xs text-muted-foreground space-y-1">
                                        <p className="font-semibold text-foreground text-sm mb-2">💡 Tips Keamanan</p>
                                        <p>• Gunakan password minimal 8 karakter dengan kombinasi huruf besar, angka, dan simbol.</p>
                                        <p>• Jangan bagikan password Anda kepada siapa pun.</p>
                                        <p>• Perbarui password secara berkala untuk keamanan lebih baik.</p>
                                    </div>
                                </div>
                            )}

                            {/* ━━ NOTIFIKASI TAB ━━ */}
                            {activeTab === "notifikasi" && (
                                <div className="glass-card rounded-xl p-6">
                                    <h3 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
                                        <Bell className="h-4 w-4 text-primary" /> Preferensi Notifikasi
                                    </h3>

                                    <div className="space-y-1 divide-y divide-border">
                                        {[
                                            {
                                                id: "notif-upload",
                                                label: "Notifikasi Upload",
                                                desc: "Beritahu saat file berhasil atau gagal diupload",
                                                value: notifUpload,
                                                onChange: setNotifUpload,
                                            },
                                            {
                                                id: "notif-scan",
                                                label: "Notifikasi Scan KK",
                                                desc: "Beritahu saat proses scan Kartu Keluarga selesai",
                                                value: notifScan,
                                                onChange: setNotifScan,
                                            },
                                            {
                                                id: "notif-system",
                                                label: "Notifikasi Sistem",
                                                desc: "Pembaruan dan informasi sistem aplikasi",
                                                value: notifSystem,
                                                onChange: setNotifSystem,
                                            },
                                        ].map((item) => (
                                            <div key={item.id} className="flex items-center justify-between py-4">
                                                <div>
                                                    <p className="font-medium text-foreground text-sm">{item.label}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                                                </div>
                                                <Switch
                                                    id={item.id}
                                                    checked={item.value}
                                                    onCheckedChange={item.onChange}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-end mt-5">
                                        <Button
                                            onClick={() =>
                                                toast({
                                                    title: "Preferensi notifikasi disimpan",
                                                    description: "Pengaturan notifikasi Anda berhasil diperbarui",
                                                })
                                            }
                                        >
                                            <Save className="h-4 w-4 mr-2" />
                                            Simpan Preferensi
                                        </Button>
                                    </div>

                                    <div className="mt-5 p-4 rounded-lg bg-muted/40">
                                        <p className="text-xs text-muted-foreground">
                                            ℹ️ Notifikasi saat ini ditampilkan sebagai pop-up di dalam aplikasi. Notifikasi push browser akan hadir di pembaruan berikutnya.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ━━ KATEGORI TAB ━━ */}
                            {activeTab === "kategori" && (
                                <div className="glass-card rounded-xl p-6">
                                    <div className="flex items-center justify-between mb-5">
                                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <Tag className="h-4 w-4 text-primary" /> Manajemen Kategori Arsip
                                        </h3>
                                        <span className="text-xs text-muted-foreground">{categories.length} kategori</span>
                                    </div>

                                    {/* Add new */}
                                    <div className="flex gap-2 mb-5">
                                        <input
                                            value={newCatInput}
                                            onChange={(e) => setNewCatInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    const ok = addCategory(newCatInput);
                                                    if (ok) { setNewCatInput(""); toast({ title: "Kategori ditambahkan" }); }
                                                    else toast({ title: "Kategori sudah ada atau nama kosong", variant: "destructive" });
                                                }
                                            }}
                                            placeholder="Nama kategori baru…"
                                            className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                const ok = addCategory(newCatInput);
                                                if (ok) { setNewCatInput(""); toast({ title: "Kategori ditambahkan" }); }
                                                else toast({ title: "Kategori sudah ada atau nama kosong", variant: "destructive" });
                                            }}
                                        >
                                            <Plus className="h-4 w-4 mr-1" /> Tambah
                                        </Button>
                                    </div>

                                    {/* Category list */}
                                    <div className="space-y-2">
                                        {categories.map((cat) => (
                                            <div key={cat} className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 group transition-colors">
                                                <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                                                {editingCat === cat ? (
                                                    <input
                                                        autoFocus
                                                        value={editingCatValue}
                                                        onChange={(e) => setEditingCatValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                const ok = renameCategory(cat, editingCatValue);
                                                                if (ok) { setEditingCat(null); toast({ title: "Kategori diperbarui" }); }
                                                                else toast({ title: "Nama kategori sudah ada", variant: "destructive" });
                                                            }
                                                            if (e.key === "Escape") setEditingCat(null);
                                                        }}
                                                        onBlur={() => setEditingCat(null)}
                                                        className="flex-1 px-2 py-0.5 text-sm rounded border border-primary focus:outline-none bg-background"
                                                    />
                                                ) : (
                                                    <span
                                                        className="flex-1 text-sm text-foreground cursor-pointer hover:text-primary"
                                                        onDoubleClick={() => { setEditingCat(cat); setEditingCatValue(cat); }}
                                                        title="Klik dua kali untuk mengedit"
                                                    >
                                                        {cat}
                                                    </span>
                                                )}

                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => { setEditingCat(cat); setEditingCatValue(cat); }}
                                                        className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                        title="Edit"
                                                    >
                                                        <ChevronRight className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => { deleteCategory(cat); toast({ title: `Kategori "${cat}" dihapus` }); }}
                                                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                        title="Hapus"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-between items-center mt-5 pt-4 border-t border-border">
                                        <p className="text-xs text-muted-foreground">Klik dua kali nama untuk mengedit. Tekan Enter untuk menyimpan.</p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => { resetToDefault(); toast({ title: "Kategori direset ke default" }); }}
                                            className="text-muted-foreground text-xs"
                                        >
                                            <RotateCcw className="h-3 w-3 mr-1.5" /> Reset Default
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* ━━ TENTANG TAB ━━ */}
                            {activeTab === "tentang" && (
                                <div className="space-y-5">
                                    {/* App info */}
                                    <div className="glass-card rounded-xl p-6">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                                                <Settings className="h-7 w-7 text-white" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold text-foreground">ArsipKu</h2>
                                                <p className="text-sm text-muted-foreground">Sistem Manajemen Arsip Digital</p>
                                                <Badge variant="outline" className="mt-1 text-xs font-mono">v1.0.0</Badge>
                                            </div>
                                        </div>

                                        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                                            ArsipKu adalah platform pengelolaan arsip digital yang membantu Anda menyimpan, mengorganisasi, dan mengakses dokumen penting secara efisien. Dilengkapi fitur scan Kartu Keluarga berbasis AI.
                                        </p>

                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: "Versi Aplikasi", value: "1.0.0" },
                                                { label: "Framework", value: "React 18 + Vite" },
                                                { label: "Backend", value: "Supabase" },
                                                { label: "UI Library", value: "shadcn/ui + Tailwind" },
                                            ].map((item) => (
                                                <div key={item.label} className="p-3 rounded-lg bg-muted/40">
                                                    <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                                                    <p className="text-sm font-medium text-foreground">{item.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Feature list */}
                                    <div className="glass-card rounded-xl p-6">
                                        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                                            <Palette className="h-4 w-4 text-primary" /> Fitur Aplikasi
                                        </h3>
                                        <div className="space-y-2">
                                            {[
                                                "Dashboard statistik arsip real-time",
                                                "Manajemen Berkas Kartu Keluarga (KK)",
                                                "Scan KK otomatis menggunakan AI",
                                                "Upload & kelola arsip digital",
                                                "Pencarian dan filter arsip canggih",
                                                "Export data ke Excel",
                                                "Import data dari Excel",
                                                "Sistem autentikasi aman",
                                            ].map((feature, i) => (
                                                <div key={i} className="flex items-center gap-2.5 text-sm">
                                                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                                                    <span className="text-muted-foreground">{feature}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Credits */}
                                    <div className="glass-card rounded-xl p-6">
                                        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                                            <Info className="h-4 w-4 text-primary" /> Informasi
                                        </h3>
                                        <div className="space-y-3 text-sm">
                                            {[
                                                { label: "Dikembangkan oleh", value: "Tim Disduk" },
                                                { label: "Lisensi", value: "MIT License" },
                                                { label: "Tahun", value: "2024 – 2025" },
                                            ].map((item) => (
                                                <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                                    <span className="text-muted-foreground">{item.label}</span>
                                                    <span className="font-medium text-foreground">{item.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Logout confirm */}
            <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Keluar dari Akun?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Sesi Anda akan diakhiri dan Anda akan diarahkan ke halaman login.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4 mr-2" /> Ya, Keluar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Pengaturan;
