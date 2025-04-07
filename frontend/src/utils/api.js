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

export default api; 