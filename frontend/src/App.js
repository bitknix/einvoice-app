import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { isAuthenticated } from './utils/auth';

// Components
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import InvoiceForm from './components/InvoiceForm';
import ExcelUpload from './components/ExcelUpload';
import InvoiceExport from './components/InvoiceExport';
import JsonImport from './components/JsonImport';
import JsonExport from './components/JsonExport';
import QRCodeView from './components/QRCodeView';
import EditInvoice from './components/EditInvoice';
import Companies from './components/Companies';
import Customers from './components/Customers';
import Items from './components/Items';
import Suppliers from './components/Suppliers';
import UploadExcel from './components/UploadExcel';
import ExportJSON from './components/ExportJSON';

// Protected route component
const PrivateRoute = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to="/login" />;
};

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected routes */}
        <Route 
          path="/" 
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/create-invoice" 
          element={
            <PrivateRoute>
              <InvoiceForm />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/upload-excel" 
          element={
            <PrivateRoute>
              <UploadExcel />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/export-invoices" 
          element={
            <PrivateRoute>
              <InvoiceExport />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/import-json" 
          element={
            <PrivateRoute>
              <JsonImport />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/export-json" 
          element={
            <PrivateRoute>
              <ExportJSON />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/qr-code/:id" 
          element={
            <PrivateRoute>
              <QRCodeView />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/edit-invoice/:id" 
          element={
            <PrivateRoute>
              <EditInvoice />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/companies" 
          element={
            <PrivateRoute>
              <Companies />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/customers" 
          element={
            <PrivateRoute>
              <Customers />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/items" 
          element={
            <PrivateRoute>
              <Items />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/suppliers" 
          element={
            <PrivateRoute>
              <Suppliers />
            </PrivateRoute>
          } 
        />
      </Routes>
    </ThemeProvider>
  );
}

export default App; 