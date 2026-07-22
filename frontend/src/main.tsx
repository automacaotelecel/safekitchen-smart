import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// === IMPORTANDO AS SUAS PÁGINAS ===
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NewLabel } from './pages/NewLabel';
import { History } from './pages/History';
import PrintQueue from './pages/PrintQueue'; 
import { PrintLabelsPage } from './pages/PrintLabelsPage';
import { AiAssistant } from './pages/AiAssistant';
import { Products } from './pages/Products';
import { ProductDetails } from './pages/ProductDetails';
import { Employees } from './pages/Employees';
import { TemperatureControl } from './pages/TemperatureControl';
import { Documents } from './pages/Documents';
import { Compliance } from './pages/Compliance';
import { Account } from './pages/Account';
import { Plans } from './pages/Plans';
import { Subscription } from './pages/Subscription';
import { Notifications } from './pages/Notifications';
import { Reports } from './pages/Reports';

// === IMPORTANDO O MENU E A PROTEÇÃO DE TELA ===
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ActiveSubscriptionRoute } from './components/ActiveSubscriptionRoute';

// === ESTILO GLOBAL ===
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
        {/* Página de Login (Pública) */}
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

        {/* Páginas Internas (Protegidas por senha e com o Menu Lateral do Layout) */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ActiveSubscriptionRoute>
                <Layout />
              </ActiveSubscriptionRoute>
            </ProtectedRoute>
          }
        >
          {/* Página Inicial padrão */}
          <Route index element={<Dashboard />} />
          
          {/* Outras páginas do seu menu */}
          <Route path="nova-etiqueta" element={<NewLabel />} />
          <Route path="historico" element={<History />} />
          <Route path="impressao" element={<PrintQueue />} />
          <Route path="ia" element={<AiAssistant />} />
          <Route path="produtos" element={<Products />} />
          <Route path="produtos/:id" element={<ProductDetails />} />
          <Route path="funcionarios" element={<Employees />} />
          <Route path="temperaturas" element={<TemperatureControl />} />
          <Route path="documentos" element={<Documents />} />
          <Route path="controles" element={<Compliance />} />
          <Route path="conta" element={<Account />} />
          <Route path="notificacoes" element={<Notifications />} />
          <Route path="relatorios" element={<Reports />} />
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
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
