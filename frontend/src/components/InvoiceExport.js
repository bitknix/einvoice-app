import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadInvoices } from '../utils/api';
import { saveAs } from 'file-saver';

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
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  CardActions
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FileDownload as FileDownloadIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon
} from '@mui/icons-material';

function InvoiceExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await downloadInvoices();
      
      // Create file name with date
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const fileName = `invoices_${dateStr}.xlsx`;
      
      // Save file
      saveAs(new Blob([response.data]), fileName);
      
      setDownloaded(true);
      setLoading(false);
    } catch (err) {
      if (err.response && err.response.data) {
        setError('Failed to download invoices. Please try again.');
      } else {
        setError('An error occurred. Please try again.');
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
            Export Invoices
          </Typography>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {downloaded ? (
          <Card sx={{ mb: 4, p: 2, bgcolor: '#f0f7f0' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="h6" color="success.main">
                  Invoices Downloaded Successfully!
                </Typography>
              </Box>
              <Typography variant="body1" gutterBottom>
                Your invoices have been exported to Excel format and downloaded to your device.
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                variant="outlined"
                component={Link}
                to="/dashboard"
              >
                Return to Dashboard
              </Button>
              <Button
                variant="contained"
                startIcon={<FileDownloadIcon />}
                onClick={handleExport}
              >
                Download Again
              </Button>
            </CardActions>
          </Card>
        ) : (
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Export Invoices to Excel
            </Typography>
            <Typography variant="body1" paragraph>
              Download all your invoices in Excel format for record keeping or further processing.
              The Excel file will contain all invoice details, including seller and buyer information,
              item descriptions, quantities, prices, and GST calculations.
            </Typography>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Export Contents
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <AssignmentIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Invoice Headers" 
                  secondary="GSTIN, Invoice No, Invoice Date, Buyer Information"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <AssignmentIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Item Details" 
                  secondary="Description, HSN Code, Quantity, Unit, Unit Price"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <AssignmentIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Tax Information" 
                  secondary="GST Rate, IGST Amount, Total Values"
                />
              </ListItem>
            </List>

            <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1, my: 3 }}>
              <Box display="flex" alignItems="flex-start">
                <InfoIcon color="info" sx={{ mr: 1, mt: 0.5 }} />
                <Typography variant="body2" color="text.secondary">
                  The exported file will be in .xlsx format and can be opened with Microsoft Excel, 
                  Google Sheets, LibreOffice Calc, or any other compatible spreadsheet software.
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button 
                variant="contained" 
                size="large"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <FileDownloadIcon />}
                onClick={handleExport}
                disabled={loading}
                sx={{ minWidth: 200 }}
              >
                {loading ? 'Exporting...' : 'Export to Excel'}
              </Button>
            </Box>
          </Paper>
        )}
      </Container>
    </>
  );
}

export default InvoiceExport; 