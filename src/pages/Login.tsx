import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Archive, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  if (user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast({ title: "Gagal mendaftar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Berhasil!", description: "Silakan cek email Anda untuk verifikasi." });
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Gagal masuk", description: error.message, variant: "destructive" });
      } else {
        navigate("/dashboard");
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--accent)/0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--accent)/0.1),transparent_50%)]" />
        <div className="relative z-10 text-primary-foreground max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-xl bg-accent">
              <Archive className="h-8 w-8 text-accent-foreground" />
            </div>
            <h1 className="text-3xl font-bold">ArsipKu</h1>
          </div>
          <h2 className="text-4xl font-extrabold leading-tight mb-4">
            Kelola Arsip Digital Anda dengan Mudah
          </h2>
          <p className="text-primary-foreground/70 text-lg leading-relaxed">
            Sistem manajemen arsip digital yang memudahkan Anda dalam menyimpan, mencari, dan mengelola dokumen penting secara efisien.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold">12K+</div>
              <div className="text-sm text-primary-foreground/60 mt-1">Arsip Tersimpan</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">500+</div>
              <div className="text-sm text-primary-foreground/60 mt-1">Pengguna Aktif</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">99.9%</div>
              <div className="text-sm text-primary-foreground/60 mt-1">Uptime</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="p-2.5 rounded-xl bg-primary">
              <Archive className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">ArsipKu</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">
              {isSignUp ? "Buat Akun Baru" : "Selamat Datang!"}
            </h2>
            <p className="text-muted-foreground mt-2">
              {isSignUp ? "Daftar untuk mulai mengelola arsip" : "Masuk ke akun Anda untuk melanjutkan"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nama Lengkap</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Nama lengkap Anda"
                    className="pl-10 h-11"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  className="pl-10 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan password"
                  className="pl-10 pr-10 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
              {isLoading ? "Memproses..." : isSignUp ? "Daftar" : "Masuk"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-8">
            {isSignUp ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-accent font-semibold hover:underline"
            >
              {isSignUp ? "Masuk" : "Daftar Sekarang"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
