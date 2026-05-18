import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';

import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NewLabel } from './pages/NewLabel';
import { History } from './pages/History';
import { LabelManagement } from './pages/LabelManagement';
import { Products } from './pages/Products';
import { ProductDetails } from './pages/ProductDetails';
import { registerServiceWorker } from './utils/pwa';
import { Employees } from './pages/Employees';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="nova-etiqueta" element={<NewLabel />} />
          <Route path="historico" element={<History />} />
          <Route path="gerenciar-etiquetas" element={<LabelManagement />} />
          <Route path="produtos" element={<Products />} />
          <Route path="produtos/:id" element={<ProductDetails />} />
          <Route path="funcionarios" element={<Employees />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

registerServiceWorker();
