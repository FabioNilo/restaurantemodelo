import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { Loader2 } from "lucide-react";
import { queryClient } from "@/lib/query-client";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const MesasPage = lazy(() => import("./pages/admin/MesasPage"));
const MesaComandaPage = lazy(() => import("./pages/admin/MesaComandaPage"));
const EdicaoLotePage = lazy(() => import("./pages/admin/EdicaoLotePage"));
const DeliveryPage = lazy(() => import("./pages/admin/DeliveryPage"));
const CaixaPage = lazy(() => import("./pages/admin/CaixaPage"));
const CardapioPage = lazy(() => import("./pages/admin/CardapioPage"));
const MetricasPage = lazy(() => import("./pages/admin/MetricasPage"));
const DesempenhoPage = lazy(() => import("./pages/admin/DesempenhoPage"));
const ConfiguracoesPage = lazy(() => import("./pages/admin/ConfiguracoesPage"));
const MarmitaEditor = lazy(() => import("./pages/admin/MarmitaEditor"));
const PedidoTracking = lazy(() => import("./pages/PedidoTracking"));
const Mesa = lazy(() => import("./pages/Mesa"));
const MesasQrPrint = lazy(() => import("./pages/admin/MesasQrPrint"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SomenteAdminLazy = lazy(() => import("./pages/admin/AdminLayout").then((m) => ({ default: m.SomenteAdmin })));

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold-ink" /></div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                {/* Página de impressão dos QR: fora do layout do painel. */}
                <Route path="/admin/mesas/qr" element={<MesasQrPrint />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="mesas" replace />} />
                  <Route path="mesas" element={<MesasPage />} />
                  <Route path="mesas/:id" element={<MesaComandaPage />} />
                  <Route path="delivery" element={<DeliveryPage />} />
                  <Route path="caixa" element={<CaixaPage />} />
                  <Route path="cardapio" element={<CardapioPage />} />
                  <Route path="cardapio/lote" element={<SomenteAdminLazy><EdicaoLotePage /></SomenteAdminLazy>} />
                  <Route path="marmitas/nova" element={<MarmitaEditor />} />
                  <Route path="marmitas/:marmitaId/editar" element={<MarmitaEditor />} />
                  <Route path="metricas" element={<SomenteAdminLazy><MetricasPage /></SomenteAdminLazy>} />
                  <Route path="desempenho" element={<SomenteAdminLazy><DesempenhoPage /></SomenteAdminLazy>} />
                  <Route path="configuracoes" element={<SomenteAdminLazy><ConfiguracoesPage /></SomenteAdminLazy>} />
                </Route>
                <Route path="/pedido/:pedidoId" element={<PedidoTracking />} />
                <Route path="/mesa/:token" element={<Mesa />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
