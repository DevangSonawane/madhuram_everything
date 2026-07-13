import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import Login from '@/pages/Login';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Materials from '@/pages/Materials';
import StockAreas from '@/pages/StockAreas';
import PurchaseRequests from '@/pages/PurchaseRequests';
import PurchaseRequestCreate from '@/pages/PurchaseRequestCreate';
import PurchaseOrders from '@/pages/PurchaseOrders';
import PurchaseOrdersPreview from '@/pages/PurchaseOrdersPreview';
import StockTransfers from '@/pages/StockTransfers';
import Consumption from '@/pages/Consumption';
import Returns from '@/pages/Returns';
import Vendors from '@/pages/Vendors';
import Reports from '@/pages/Reports';
import AuditLogs from '@/pages/AuditLogs';
import Projects from '@/pages/Projects';
import BOQ from '@/pages/BOQ';
import BOQList from '@/pages/BOQList';
import MAS from '@/pages/MAS';
import Samples from '@/pages/Samples';
import SamplePreview from '@/pages/SamplePreview';
import SampleEdit from '@/pages/SampleEdit';
import VendorComparison from '@/pages/VendorComparison';
import VendorComparisonModule from '@/pages/VendorComparisonModule';
import VendorComparisonUpload from '@/pages/VendorComparisonUpload';
import VendorComparisonItems from '@/pages/VendorComparisonItems';
import VendorItems from '@/pages/VendorItems';
import Challans from '@/pages/Challans';
import NewChallan from '@/pages/NewChallan';
import ChallanItemDetail from '@/pages/ChallanItemDetail';
import MER from '@/pages/MER';
import MIR from '@/pages/MIR';
import MIRCreate from '@/pages/MIRCreate';
import MIRView from '@/pages/MIRView';
import MIRPreview from '@/pages/MIRPreview';
import ITR from '@/pages/ITR';
import ITRPreview from '@/pages/ITRPreview';
import Invoices from '@/pages/Invoices';
import InvoiceCreate from '@/pages/InvoiceCreate';
import InvoicePreview from '@/pages/InvoicePreview';
import Billing from '@/pages/Billing';
import BillingInvoiceEditor from '@/pages/BillingInvoiceEditor';
import LodhaRABill from '@/pages/LodhaRABill';
import Documents from '@/pages/Documents';
import Users from '@/pages/Users';
import Profile from '@/pages/Profile';
import SettingsAccessControl from '@/pages/SettingsAccessControl';
import Attendance from '@/pages/Attendance';
import AttendanceUserHistory from '@/pages/AttendanceUserHistory';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ProjectSelection from '@/pages/ProjectSelection';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Inventory from '@/pages/Inventory';
import AddInventory from '@/pages/AddInventory';
import InventoryHistory from '@/pages/InventoryHistory';
import InventoryDetail from '@/pages/InventoryDetail';
import InventoryFull from '@/pages/InventoryFull';
import InventoryItemHistory from '@/pages/InventoryItemHistory';
import QuotesCreate from '@/pages/QuotesCreate';
import QuotesHome from '@/pages/QuotesHome';
import QuotesList from '@/pages/QuotesList';
import QuotesPreview from '@/pages/QuotesPreview';
import QuotesSearch from '@/pages/QuotesSearch';

function AttendanceUserHistoryRedirect() {
  const { userId } = useParams();
  return <Navigate to={userId ? `/attendance/user/${userId}` : "/attendance?tab=users"} replace />;
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <AuthProvider>
        <ProjectProvider>
          <NotificationProvider>
            <Router>
              <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route path="/projects" element={
                  <ProtectedRoute>
                    <ProjectSelection />
                  </ProtectedRoute>
                } />
                <Route path="/attendance" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Attendance />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/attendance/user" element={
                  <ProtectedRoute>
                    <Navigate to="/attendance?tab=users" replace />
                  </ProtectedRoute>
                } />
                <Route path="/attendance/user/:userId" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <AttendanceUserHistory />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/inventory/add" element={
                  <ProtectedRoute>
                    <MainLayout contentClassName="w-full max-w-none">
                      <AddInventory inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/inventory/full" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <InventoryFull />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/inventory/history" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <InventoryHistory inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/inventory/:inventoryId/history" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <InventoryItemHistory inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/quotes/add" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <QuotesHome inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/quotes/list" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <QuotesList inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/quotes/search" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <QuotesSearch inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/quotes/new" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <QuotesCreate inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/quotes/:id" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <QuotesPreview inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/quotes/:id/edit" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <QuotesCreate inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/vendors" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Vendors inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/vendor-comparison" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorComparison inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/vendor-comparison/new" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorComparisonModule />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/vendor-comparison/upload" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorComparisonUpload inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/vendor-comparison/vendor/:vendorName" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorComparisonItems />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/vendors/:vendorName/items" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorItems />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/:projectId/vendor-comparison/upload" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorComparisonUpload inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/:projectId/vendor-comparison/upload" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorComparisonUpload inLayout />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/:projectId/vendor-comparison/vendor/:vendorName" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorComparisonItems />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/:projectId/vendors/:vendorName/items" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorItems />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/:projectId/vendor-comparison/vendor/:vendorName" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorComparisonItems />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/:projectId/vendors/:vendorName/items" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorItems />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/projects/:projectId/vendor-comparison/new" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorComparisonModule />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/:projectId/vendor-comparison/new" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <VendorComparisonModule />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/:projectId/challans/new/details" element={
                  <ProtectedRoute>
                    <ChallanItemDetail />
                  </ProtectedRoute>
                } />
                
                <Route path="/:projectId" element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="materials" element={<Materials />} />
                  <Route path="stock-areas" element={<StockAreas />} />
                  <Route path="purchase-requests" element={<PurchaseRequests />} />
                  <Route path="purchase-requests/create" element={<PurchaseRequestCreate />} />
                  <Route path="vendor-comparison" element={<VendorComparison />} />
                  <Route path="purchase-orders" element={<PurchaseOrders />} />
                  <Route path="purchase-orders/manual" element={<PurchaseOrders />} />
                  <Route path="purchase-orders/preview" element={<PurchaseOrdersPreview />} />
                  <Route path="stock-transfers" element={<StockTransfers />} />
                  <Route path="consumption" element={<Consumption />} />
                  <Route path="returns" element={<Returns />} />
                  <Route path="vendors" element={<Vendors />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="audit-logs" element={<AuditLogs />} />
                  <Route path="boq" element={<BOQList />} />
                  <Route path="boq/manage" element={<BOQ />} />
                  <Route path="mas" element={<MAS />} />
                  <Route path="samples" element={<Samples />} />
                  <Route path="samples/create" element={<Samples />} />
                  <Route path="samples/preview/:id" element={<SamplePreview />} />
                  <Route path="samples/edit/:id" element={<SampleEdit />} />
                  <Route path="challans" element={<Challans />} />
                  <Route path="challans/new" element={<NewChallan />} />
                  <Route path="challans/detail" element={<ChallanItemDetail />} />
                  <Route path="mer" element={<MER />} />
                  <Route path="mir" element={<MIR />} />
                  <Route path="mir/create" element={<MIRCreate />} />
                  <Route path="mir/:mirId/preview" element={<MIRView />} />
                  <Route path="mir/:mirId/edit" element={<MIRCreate />} />
                  <Route path="mir/preview" element={<MIRPreview />} />
                  <Route path="itr" element={<ITR />} />
                  <Route path="itr/create" element={<ITRPreview />} />
                  <Route path="itr/manual" element={<ITRPreview />} />
                  <Route path="itr/preview" element={<ITRPreview />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="invoices/create" element={<InvoiceCreate />} />
                  <Route path="invoices/preview" element={<InvoicePreview />} />
                  {/* Project-wise attendance list removed; redirect to global attendance */}
                  <Route path="attendance" element={<Navigate to="/attendance" replace />} />
                  <Route path="attendance/user" element={<Navigate to="/attendance" replace />} />
                  <Route path="attendance/user/:userId" element={<AttendanceUserHistoryRedirect />} />
                  <Route path="vendor-comparison/upload" element={<VendorComparisonUpload inLayout />} />
                  <Route path="billing" element={<Billing />} />
                  <Route path="billing/invoice-editor" element={<BillingInvoiceEditor />} />
                  <Route path="billing/lodha/new" element={<LodhaRABill />} />
                  <Route path="billing/lodha/:billId" element={<LodhaRABill />} />
                  <Route path="billing/hiranandani/new" element={<InvoiceCreate />} />
                  <Route path="billing/hiranandani/:billId" element={<InvoiceCreate />} />
                  <Route path="documents" element={<Documents />} />
                  <Route path="user-management" element={<Users />} />
                  <Route path="access-control" element={<SettingsAccessControl />} />
                  <Route path="users" element={<Navigate to="user-management" replace />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="settings" element={<Profile />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="inventory/add" element={<AddInventory />} />
                  <Route path="inventory-history" element={<InventoryHistory />} />
                  <Route path="inventory/:id" element={<InventoryDetail />} />
                </Route>
              </Routes>
              <Toaster />
            </Router>
          </NotificationProvider>
        </ProjectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
