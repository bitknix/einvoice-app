import axios from 'axios';
import { getToken, removeToken } from './auth';

// Create axios instance with baseURL
const api = axios.create({
  baseURL: 'http://localhost:8080/api'
});

// Add interceptor to add token to requests
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add interceptor to handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid, logout user
      removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication
export const login = (email, password) => {
  return api.post('/login', { email, password });
};

export const register = (email, password) => {
  console.log('Registering user:', { email, password });
  return api.post('/register', { email, password });
};

// Invoices
export const generateInvoice = (invoiceData) => {
  return api.post('/generate-invoice', invoiceData);
};

export const getInvoices = () => {
  return api.get('/invoices');
};

export const uploadExcel = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/upload-excel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

export const downloadInvoices = () => {
  return api.get('/export-invoices', {
    responseType: 'blob'
  });
};

export const getQRCode = (id) => {
  return `/api/qr/${id}`;
};

// New JSON Import/Export endpoints
export const importJSON = (jsonData) => {
  return api.post('/import-json', jsonData);
};

// Export JSON function is no longer needed as we're handling download directly in the component
// Keeping it for backward compatibility
export const exportJSON = (id) => {
  console.log('Using exportJSON from API utility is deprecated, use direct download instead');
  
  // Create a temporary link element
  const link = document.createElement('a');
  link.href = `${api.defaults.baseURL}/export-json/${id}`;
  link.setAttribute('download', `invoice-${id}.json`);
  
  // Add the auth token
  const token = getToken();
  if (token) {
    // For simple downloads, we include the token in the URL to authenticate
    link.href += `?token=${token}`;
  }
  
  // Append to body, click and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // No need to return anything, as we're handling the download directly
  return new Promise(resolve => setTimeout(resolve, 100));
};

export const exportAllJSON = () => {
  return api.get('/export-all-json', {
    responseType: 'blob'
  });
};

// Invoice status management
export const markInvoiceExported = (id) => {
  return api.put(`/invoices/${id}/mark-exported`);
};

// Edit invoice functions
export const getInvoiceById = (id) => {
  return api.get(`/invoices/${id}`);
};

export const updateInvoice = (id, invoiceData) => {
  return api.put(`/invoices/${id}`, invoiceData);
};

export const deleteInvoice = (id) => {
  return api.delete(`/invoices/${id}`);
};

// Supplier API functions
export const getSuppliers = () => {
  return api.get('/suppliers');
};

export const createSupplier = (supplierData) => {
  return api.post('/suppliers', supplierData);
};

export const updateSupplier = (id, supplierData) => {
  return api.put(`/suppliers/${id}`, supplierData);
};

export const deleteSupplier = (id) => {
  return api.delete(`/suppliers/${id}`);
};

// Template download
export const downloadExcelTemplate = () => {
  // Create a temporary link element
  const link = document.createElement('a');
  link.href = `${api.defaults.baseURL.replace('/api', '')}/api/download-template`;
  link.setAttribute('download', 'invoice_template.xlsx');
  
  // Add the auth token if needed
  const token = getToken();
  if (token) {
    link.href += `?token=${token}`;
  }
  
  // Append to body, click and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // No need to return anything, as we're handling the download directly
  return new Promise(resolve => setTimeout(resolve, 100));
};

export default api; 