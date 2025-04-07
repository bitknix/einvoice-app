import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { uploadExcel } from '../utils/api';

// Material UI components
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Card
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

function ExcelUpload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadedInvoices, setUploadedInvoices] = useState([]);

  const onDrop = useCallback((acceptedFiles) => {
    const selectedFile = acceptedFiles[0];
    
    // Check file type (only allow Excel files)
    if (selectedFile && 
        (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
         selectedFile.type === 'application/vnd.ms-excel')) {
      setFile(selectedFile);
      setError('');
    } else {
      setFile(null);
      setError('Only Excel files (.xlsx, .xls) are accepted');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1
  });

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await uploadExcel(file);
      setUploadedInvoices(response.data.invoices || []);
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.error || 'Failed to upload Excel file');
      } else {
        setError('An error occurred during upload. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <>
      {/* App bar */}
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            component={Link}
            to="/dashboard"
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Upload Invoice Excel
          </Typography>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success ? (
          <Card sx={{ mb: 4, p: 2, bgcolor: '#f0f7f0' }}>
            <Box display="flex" alignItems="center" mb={2}>
              <CheckCircleIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="h6" color="success.main">
                Excel file uploaded successfully!
              </Typography>
            </Box>
            <Typography variant="body1" gutterBottom>
              {uploadedInvoices.length} invoice(s) processed.
            </Typography>
            <Box mt={2} display="flex" justifyContent="space-between">
              <Button
                variant="outlined"
                component={Link}
                to="/dashboard"
              >
                Return to Dashboard
              </Button>
              <Button
                variant="contained"
                component={Link}
                to="/export-invoices"
              >
                Export Invoices
              </Button>
            </Box>
          </Card>
        ) : (
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Upload Excel File
            </Typography>
            <Typography variant="body1" paragraph>
              Upload an Excel file containing invoice data. The Excel file should have columns for Seller GSTIN,
              Invoice Number, Invoice Date, Buyer GSTIN, Buyer Name, Product Description, HSN Code, Quantity, Unit, Unit Price, and GST Rate.
            </Typography>

            {/* Upload area */}
            <Box sx={{ mt: 4, mb: 4 }}>
              <Paper
                {...getRootProps()}
                elevation={0}
                sx={{
                  border: '2px dashed #ccc',
                  borderColor: isDragReject ? 'error.main' : isDragActive ? 'primary.main' : '#ccc',
                  borderRadius: 2,
                  p: 5,
                  textAlign: 'center',
                  bgcolor: isDragActive ? 'rgba(25, 118, 210, 0.04)' : 'background.paper',
                  cursor: 'pointer'
                }}
              >
                <input {...getInputProps()} />
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                
                {isDragActive ? (
                  <Typography variant="h6" color="primary">
                    Drop the Excel file here...
                  </Typography>
                ) : (
                  <Typography variant="h6">
                    Drag & drop an Excel file here, or click to select
                  </Typography>
                )}
                
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Only .xlsx and .xls files are accepted
                </Typography>
              </Paper>
            </Box>

            {/* Selected file info */}
            {file && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1">
                  Selected file:
                </Typography>
                <Typography variant="body1" color="primary.main">
                  {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </Typography>
              </Box>
            )}

            {/* Upload button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                size="large"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                onClick={handleUpload}
                disabled={!file || loading}
              >
                {loading ? 'Uploading...' : 'Upload Excel'}
              </Button>
            </Box>
          </Paper>
        )}

        {/* Uploaded invoices list */}
        {uploadedInvoices.length > 0 && (
          <Paper elevation={2} sx={{ p: 3, mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Processed Invoices
            </Typography>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice No</TableCell>
                    <TableCell>QR Code</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploadedInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.invoice_no}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => window.open(invoice.qr_url, '_blank')}
                        >
                          View QR
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* Template explanation */}
        <Paper elevation={1} sx={{ p: 3, mt: 4, bgcolor: '#f5f5f5' }}>
          <Typography variant="h6" gutterBottom>
            Excel Template Format
          </Typography>
          <Typography variant="body2" paragraph>
            Your Excel file should contain the following columns:
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Column</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Example</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Seller GSTIN</TableCell>
                  <TableCell>15-character GST identification number</TableCell>
                  <TableCell>06AABFM7416P1ZY</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Invoice No</TableCell>
                  <TableCell>Unique invoice number</TableCell>
                  <TableCell>MISL/24-25/2544</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Invoice Date</TableCell>
                  <TableCell>Date in DD/MM/YYYY format</TableCell>
                  <TableCell>27/03/2025</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Buyer GSTIN</TableCell>
                  <TableCell>Buyer's GST number or URP for unregistered</TableCell>
                  <TableCell>URP</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Buyer Name</TableCell>
                  <TableCell>Legal name of the buyer</TableCell>
                  <TableCell>M/S. SPOTLIGHT PTY. LTD.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Buyer Address</TableCell>
                  <TableCell>Address of the buyer</TableCell>
                  <TableCell>L6 111 CECIL STREET, MELBOURNE</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Buyer Location</TableCell>
                  <TableCell>Location/city of the buyer</TableCell>
                  <TableCell>AUSTRALIA</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Item Description</TableCell>
                  <TableCell>Description of the product</TableCell>
                  <TableCell>100% JUTE WOVEN FABRIC</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>HSN Code</TableCell>
                  <TableCell>Harmonized System Nomenclature code</TableCell>
                  <TableCell>53101013</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Numeric quantity</TableCell>
                  <TableCell>750</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Unit</TableCell>
                  <TableCell>Unit of measurement</TableCell>
                  <TableCell>MTR</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Unit Price</TableCell>
                  <TableCell>Price per unit</TableCell>
                  <TableCell>140.384</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>GST Rate</TableCell>
                  <TableCell>GST rate as percentage</TableCell>
                  <TableCell>5</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    </>
  );
}

export default ExcelUpload; 