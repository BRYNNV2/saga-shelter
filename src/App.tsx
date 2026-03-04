import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BerkasKK from "./pages/BerkasKK";
import BerkasKTP from "./pages/BerkasKTP";
import SemuaArsip from "./pages/SemuaArsip";
import UploadArsip from "./pages/UploadArsip";
import Pengaturan from "./pages/Pengaturan";
import Laporan from "./pages/Laporan";
import RiwayatAktivitas from "./pages/RiwayatAktivitas";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/berkas-kk"
              element={
                <ProtectedRoute>
                  <BerkasKK />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/berkas-ktp"
              element={
                <ProtectedRoute>
                  <BerkasKTP />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/arsip"
              element={
                <ProtectedRoute>
                  <SemuaArsip />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/upload"
              element={
                <ProtectedRoute>
                  <UploadArsip />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/pengaturan"
              element={
                <ProtectedRoute>
                  <Pengaturan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/laporan"
              element={
                <ProtectedRoute>
                  <Laporan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/riwayat"
              element={
                <ProtectedRoute>
                  <RiwayatAktivitas />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
