import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken } from '../utils/auth';
import {
  Container,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Chip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';

const ExportJSON = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [publishedInvoices, setPublishedInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  const fetchPublishedInvoices = async () => {
    try {
      setLoadingInvoices(true);
      setError(null);
      const token = getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('/api/invoices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      const data = await response.json();
      if (!data || !data.invoices) {
        throw new Error('Invalid response format');
      }

      // Filter only published (exported) invoices
      const published = data.invoices.filter(invoice => invoice.exported);
      setPublishedInvoices(published);
    } catch (error) {
      console.error('Error fetching published invoices:', error);
      setError(error.message || 'Failed to load published invoices');
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    fetchPublishedInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportAllJSON = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('/api/export-all-json', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export JSON');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'all-invoices-gst.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      setError('Failed to export JSON files');
    } finally {
      setLoading(false);
    }
  };

  const handleExportSingleJSON = async (id, invoiceNumber) => {
    try {
      const token = getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`/api/export-json/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export JSON');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceNumber || id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      setError(`Failed to export invoice #${id}`);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 3 }}
        >
          Go Back
        </Button>

        <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Export All Invoices
          </Typography>
          <Typography variant="body1" paragraph>
            Export all your published invoices as GST-compliant JSON files for government portals.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            onClick={handleExportAllJSON}
            disabled={loading}
            startIcon={<CloudDownloadIcon />}
            sx={{ mt: 2 }}
          >
            {loading ? (
              <>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                Exporting...
              </>
            ) : (
              'Export All Published Invoices'
            )}
          </Button>
        </Paper>

        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            Published Invoices
          </Typography>
          <Typography variant="body1" paragraph>
            Download individual GST-compliant JSON files for specific invoices.
          </Typography>

          <Divider sx={{ my: 2 }} />

          {loadingInvoices ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : publishedInvoices.length === 0 ? (
            <Alert severity="info">
              No published invoices found. Mark invoices as published to see them here.
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Published Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {publishedInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.invoice_number || `INV-${invoice.id}`}</TableCell>
                      <TableCell>{invoice.customer_name || 'N/A'}</TableCell>
                      <TableCell>₹{invoice.total_amount || 0}</TableCell>
                      <TableCell>
                        {invoice.exported_at ? formatDate(invoice.exported_at) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<DownloadIcon />}
                          onClick={() => handleExportSingleJSON(invoice.id, invoice.invoice_number)}
                        >
                          JSON
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default ExportJSON; 