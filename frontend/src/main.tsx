import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { ActiveSubscriptionRoute } from './components/ActiveSubscriptionRoute';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import './index.css';

const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const NewLabel = lazy(() => import('./pages/NewLabel').then((module) => ({ default: module.NewLabel })));
const History = lazy(() => import('./pages/History').then((module) => ({ default: module.History })));
const PrintQueue = lazy(() => import('./pages/PrintQueue'));
const PrintLabelsPage = lazy(() => import('./pages/PrintLabelsPage').then((module) => ({ default: module.PrintLabelsPage })));
const AiAssistant = lazy(() => import('./pages/AiAssistant').then((module) => ({ default: module.AiAssistant })));
const Products = lazy(() => import('./pages/Products').then((module) => ({ default: module.Products })));
const ProductDetails = lazy(() => import('./pages/ProductDetails').then((module) => ({ default: module.ProductDetails })));
const Employees = lazy(() => import('./pages/Employees').then((module) => ({ default: module.Employees })));
const TemperatureControl = lazy(() => import('./pages/TemperatureControl').then((module) => ({ default: module.TemperatureControl })));
const Documents = lazy(() => import('./pages/Documents').then((module) => ({ default: module.Documents })));
const Compliance = lazy(() => import('./pages/Compliance').then((module) => ({ default: module.Compliance })));
const Account = lazy(() => import('./pages/Account').then((module) => ({ default: module.Account })));
const Plans = lazy(() => import('./pages/Plans').then((module) => ({ default: module.Plans })));
const Subscription = lazy(() => import('./pages/Subscription').then((module) => ({ default: module.Subscription })));
const Notifications = lazy(() => import('./pages/Notifications').then((module) => ({ default: module.Notifications })));
const Reports = lazy(() => import('./pages/Reports').then((module) => ({ default: module.Reports })));
const Layout = lazy(() => import('./components/Layout').then((module) => ({ default: module.Layout })));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f8f8] px-4">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#19d09c]/25 border-t-[#19d09c]" />
        <p className="mt-4 text-sm font-black text-[#073b4c]">Carregando SafeKitchen...</p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/planos" element={<Plans />} />
            <Route
              path="/assinatura"
              element={
                <ProtectedRoute>
                  <Subscription />
                </ProtectedRoute>
              }
            />

            <Route
              element={
                <ProtectedRoute>
                  <ActiveSubscriptionRoute>
                    <Layout />
                  </ActiveSubscriptionRoute>
                </ProtectedRoute>
              }
            >
              <Route path="/painel" element={<Dashboard />} />
              <Route path="/nova-etiqueta" element={<NewLabel />} />
              <Route path="/historico" element={<History />} />
              <Route path="/impressao" element={<PrintQueue />} />
              <Route path="/ia" element={<AiAssistant />} />
              <Route path="/produtos" element={<Products />} />
              <Route path="/produtos/:id" element={<ProductDetails />} />
              <Route path="/funcionarios" element={<Employees />} />
              <Route path="/temperaturas" element={<TemperatureControl />} />
              <Route path="/documentos" element={<Documents />} />
              <Route path="/controles" element={<Compliance />} />
              <Route path="/conta" element={<Account />} />
              <Route path="/notificacoes" element={<Notifications />} />
              <Route path="/relatorios" element={<Reports />} />
            </Route>

            <Route
              path="/imprimir-folha"
              element={
                <ProtectedRoute>
                  <ActiveSubscriptionRoute>
                    <PrintLabelsPage />
                  </ActiveSubscriptionRoute>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
);
