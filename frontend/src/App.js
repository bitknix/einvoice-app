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
              <ExcelUpload />
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
      </Routes>
    </ThemeProvider>
  );
}

export default App; 