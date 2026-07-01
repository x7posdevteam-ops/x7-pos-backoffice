import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MerchantFrame } from './components/MerchantFrame/MerchantFrame';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ResetPasswordSuccessPage } from './pages/ResetPasswordSuccessPage';
import SaaSFrame from './components/SaaSFrame/SaaSFrame';
import { isAuthenticated } from './lib/auth-storage';

function RootRedirect() {
  return (
    <Navigate replace to={isAuthenticated() ? '/dashboard' : '/login'} />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/reset-password/success"
          element={<ResetPasswordSuccessPage />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MerchantFrame />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/products"
          element={
            <ProtectedRoute>
              <MerchantFrame />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/categories"
          element={
            <ProtectedRoute>
              <MerchantFrame />
            </ProtectedRoute>
          }
        />
        <Route
          path="/legal/privacy-policy"
          element={
            <ProtectedRoute>
              <MerchantFrame />
            </ProtectedRoute>
          }
        />
        <Route
          path="/legal/terms-of-service"
          element={
            <ProtectedRoute>
              <MerchantFrame />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support/help-center"
          element={
            <ProtectedRoute>
              <MerchantFrame />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saas-admin"
          element={<SaaSFrame />}
        />
        <Route path="*" element={<Navigate replace to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
