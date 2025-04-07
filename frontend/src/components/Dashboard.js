import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getInvoices } from '../utils/api';
import { removeToken, getUserInfo } from '../utils/auth';
import { format } from 'date-fns';

// Material UI components
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  AppBar,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions
} from '@mui/material';
import {
  Add as AddIcon,
  FileUpload as FileUploadIcon,
  FileDownload as FileDownloadIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';

function Dashboard() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    setUserInfo(getUserInfo());
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await getInvoices();
      setInvoices(response.data.invoices || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to load invoices');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  const handleOpenUserMenu = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setUserMenuAnchor(null);
  };

  const formatDate = (dateString) => {
    try {
      // Handle date format like "27/03/2025"
      if (dateString && dateString.includes('/')) {
        const [day, month, year] = dateString.split('/');
        return `${day}/${month}/${year}`;
      }
      // For ISO dates from created_at
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  return (
    <>
      {/* App bar */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            E-Invoice App
          </Typography>
          <IconButton color="inherit" onClick={handleOpenUserMenu}>
            <AccountCircleIcon />
          </IconButton>
          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={handleCloseUserMenu}
          >
            {userInfo && (
              <MenuItem disabled>
                {userInfo.email}
              </MenuItem>
            )}
            <MenuItem onClick={handleLogout}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        {/* Action buttons */}
        <Box sx={{ mb: 4 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Create Invoice
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Generate a new GST-compliant invoice with automatic calculations.
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    component={Link}
                    to="/create-invoice"
                    startIcon={<AddIcon />}
                    variant="contained"
                    fullWidth
                  >
                    Create Invoice
                  </Button>
                </CardActions>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Upload Excel
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Import invoices from Excel spreadsheet with bulk processing.
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    component={Link}
                    to="/upload-excel"
                    startIcon={<FileUploadIcon />}
                    variant="contained"
                    fullWidth
                  >
                    Upload Excel
                  </Button>
                </CardActions>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Export Invoices
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Download all your invoices as an Excel spreadsheet.
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    component={Link}
                    to="/export-invoices"
                    startIcon={<FileDownloadIcon />}
                    variant="contained"
                    fullWidth
                  >
                    Export Invoices
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Invoices list */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Your Invoices
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box display="flex" justifyContent="center" sx={{ my: 4 }}>
              <CircularProgress />
            </Box>
          ) : invoices.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice No</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Buyer</TableCell>
                    <TableCell>Seller GSTIN</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>QR Code</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.invoice_no}</TableCell>
                      <TableCell>{formatDate(invoice.date)}</TableCell>
                      <TableCell>{invoice.buyer_name}</TableCell>
                      <TableCell>{invoice.seller_gstin}</TableCell>
                      <TableCell align="right">{formatCurrency(invoice.total_value)}</TableCell>
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
          ) : (
            <Box sx={{ py: 4 }}>
              <Typography align="center" color="text.secondary">
                No invoices found. Create your first invoice!
              </Typography>
              <Box display="flex" justifyContent="center" sx={{ mt: 2 }}>
                <Button
                  component={Link}
                  to="/create-invoice"
                  variant="contained"
                  startIcon={<AddIcon />}
                >
                  Create Invoice
                </Button>
              </Box>
            </Box>
          )}
        </Paper>
      </Container>
    </>
  );
}

export default Dashboard; 