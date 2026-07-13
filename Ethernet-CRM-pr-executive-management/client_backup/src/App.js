import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './contexts/AuthContext.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import LoginPage from './pages/loginPage.tsx';
import HomePage from "./pages/homePage.tsx"
import MainLayout from './layouts/mainLayout.tsx';
import ExpenseTable from './pages/expenseTrackerPage.tsx';
import ExecutiveManagement from './pages/executiveManagement.tsx'
import FieldSurveyDashboard from './pages/fieldSurveyPage.tsx';
import VehicleTimelinePage from './pages/travelTracker.tsx';
import AssetsInventory from './pages/accetsInventory.tsx';
import LeadsPage from './pages/leadsPage.tsx';
import CustomerDetailsPage from './pages/customerDetailsPage.tsx';
import CustomerKycPage from './pages/customerKycPage.tsx';
import KycDetailsPage from './pages/kycDetailsPage.tsx';
import PaymentPage from './pages/paymentPage.tsx';
import CustomerDetailPage from './pages/customerDetailPage.tsx';
import CheckStatusPage from './pages/checkStatusPage.tsx';

const App = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes */}
            <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/activity" replace />} />
              <Route path="activity" element={<HomePage />} />
              <Route path="expense-tracker" element={<ExpenseTable />} />
              <Route path="leads-master" element={<LeadsPage />} />
              <Route path="lead/customer-details/:uniqueId" element={<CustomerDetailsPage />} />
              <Route path="kyc-details/:uniqueId" element={<KycDetailsPage />} />
              <Route path="travel-tracker" element={<VehicleTimelinePage />} />
              <Route path="field-survey" element={<FieldSurveyDashboard />} />
              <Route path="executive-management" element={<ExecutiveManagement />} />
              <Route path="assets-inventory" element={<AssetsInventory />} />
            </Route>
            <Route path="/customer" element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
              <Route path="details/:lead_id" element={<CustomerDetailPage />} />
              <Route path="checkStatus/:uniqueId" element={<CheckStatusPage />} />
              <Route path="kyc/:uniqueId" element={<CustomerKycPage />} />
              <Route path="payment/:uniqueId" element={<PaymentPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;