import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getInvoices, markInvoiceExported } from '../utils/api';
import { removeToken, getUserInfo, getToken } from '../utils/auth';
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
  CardActions,
  Tabs,
  Tab,
  Badge,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  FileUpload as FileUploadIcon,
  FileDownload as FileDownloadIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  ImportExport as ImportExportIcon,
  Code as CodeIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Category as CategoryIcon,
  Search as SearchIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  QrCode as QrCodeIcon,
  FilterList as FilterIcon,
  LocalShipping as LocalShippingIcon,
  CheckCircleOutline as CheckCircleOutlineIcon
} from '@mui/icons-material';

function Dashboard() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [userInfo, setUserInfo] = useState(getUserInfo());
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [filterDialog, setFilterDialog] = useState(false);
  const [markAsPublishedDialog, setMarkAsPublishedDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setUserInfo(getUserInfo());
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await getInvoices();
      setInvoices(response.data.invoices || []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError(err.response?.data?.error || 'Failed to fetch invoices. Please try again.');
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

  const handleOpenActionMenu = (event, invoiceId) => {
    setSelectedInvoiceId(invoiceId);
    setActionMenuAnchor(event.currentTarget);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleOpenFilterDialog = () => {
    setFilterDialog(true);
  };

  const handleCloseFilterDialog = () => {
    setFilterDialog(false);
  };

  const handleMarkInvoicePublished = async (id) => {
    try {
      await markInvoiceExported(id);
      
      // Update local state
      setInvoices(invoices.map(invoice => {
        if (invoice.id === id) {
          return { ...invoice, exported: true, exported_at: new Date().toISOString() };
        }
        return invoice;
      }));
      
      // Close dialog if open
      setMarkAsPublishedDialog(false);
    } catch (error) {
      console.error("Failed to mark invoice as published:", error);
      setError("Failed to mark invoice as published. Please try again.");
    }
  };

  const handleViewQRCode = (id) => {
    navigate(`/qr-code/${id}`);
    handleCloseActionMenu();
  };

  const handleEditInvoice = (id) => {
    navigate(`/edit-invoice/${id}`);
    handleCloseActionMenu();
  };

  const handleDeleteInvoice = async (id) => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete invoice');
      }

      // Remove the deleted invoice from the state
      setInvoices(prevInvoices => prevInvoices.filter(invoice => invoice.id !== id));
      setSuccessMessage('Invoice deleted successfully');
      
      // Close dialog if open
      setDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting invoice:', error);
      setError(`Failed to delete invoice: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = async (id) => {
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
      link.download = `invoice-${id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      setError('Failed to export JSON file');
    }
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

  // Filter invoices based on tab and search term
  const filteredInvoices = invoices.filter(invoice => {
    // Search term filter
    const searchMatch = !searchTerm || 
      invoice.invoice_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.buyer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.seller_gstin.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Tab filter
    switch(tabValue) {
      case 0: // All
        return searchMatch;
      case 1: // Pending
        return searchMatch && !invoice.exported;
      case 2: // Published
        return searchMatch && invoice.exported;
      default:
        return searchMatch;
    }
  });

  const handleOpenDeleteDialog = () => {
    setDeleteDialog(true);
    handleCloseActionMenu();
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialog(false);
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

      <Container maxWidth="lg" sx={{ mt: 3 }}>
        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Total Invoices
                </Typography>
                <Typography variant="h3">
                  {loading ? <CircularProgress size={24} /> : invoices.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Pending Export
                </Typography>
                <Typography variant="h3">
                  {loading ? <CircularProgress size={24} /> : 
                    invoices.filter(invoice => !invoice.exported).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Published
                </Typography>
                <Typography variant="h3">
                  {loading ? <CircularProgress size={24} /> : 
                    invoices.filter(invoice => invoice.exported).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Action buttons grid */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            GST E-Invoicing Tools
          </Typography>
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
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Import JSON
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Import GST-compliant JSON invoices following NIC's official e-Invoice schema.
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    component={Link}
                    to="/import-json"
                    startIcon={<CodeIcon />}
                    variant="contained"
                    fullWidth
                  >
                    Import JSON
                  </Button>
                </CardActions>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Export JSON
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Export your invoices as GST-compliant JSON for government portals.
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    component={Link}
                    to="/export-json"
                    startIcon={<ImportExportIcon />}
                    variant="contained"
                    fullWidth
                  >
                    Export JSON
                  </Button>
                </CardActions>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Manage Masters
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage companies, customers, items, and other master data.
                  </Typography>
                </CardContent>
                <CardActions sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<BusinessIcon />}
                    variant="outlined"
                    component={Link}
                    to="/companies"
                  >
                    Companies
                  </Button>
                  <Button
                    size="small"
                    startIcon={<PeopleIcon />}
                    variant="outlined"
                    component={Link}
                    to="/customers"
                  >
                    Customers
                  </Button>
                  <Button
                    size="small"
                    startIcon={<CategoryIcon />}
                    variant="outlined"
                    component={Link}
                    to="/items"
                  >
                    Items
                  </Button>
                  <Button
                    size="small"
                    startIcon={<LocalShippingIcon />}
                    variant="outlined"
                    component={Link}
                    to="/suppliers"
                  >
                    Suppliers
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
            {successMessage}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ py: 5 }}>
            <CircularProgress />
          </Box>
        ) : invoices.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>No Invoices Found</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              You haven't created any invoices yet. Use the tools above to get started!
            </Typography>
          </Paper>
        ) : (
          <Paper elevation={2} sx={{ p: 3 }}>
            <Box 
              display="flex" 
              justifyContent="space-between" 
              alignItems="center" 
              sx={{ mb: 2 }}
            >
              <Typography variant="h5">
                Your Invoices
              </Typography>
              <Box>
                <IconButton 
                  onClick={() => handleViewModeChange('grid')}
                  color={viewMode === 'grid' ? 'primary' : 'default'}
                >
                  <ViewModuleIcon />
                </IconButton>
                <IconButton 
                  onClick={() => handleViewModeChange('list')}
                  color={viewMode === 'list' ? 'primary' : 'default'}
                >
                  <ViewListIcon />
                </IconButton>
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Tabs 
                value={tabValue} 
                onChange={handleTabChange}
                indicatorColor="primary"
                textColor="primary"
              >
                <Tab 
                  label={
                    <Badge badgeContent={invoices.length} color="primary">
                      All Invoices
                    </Badge>
                  } 
                  id="tab-0"
                />
                <Tab 
                  label={
                    <Badge 
                      badgeContent={invoices.filter(inv => !inv.exported).length} 
                      color="error"
                    >
                      Pending
                    </Badge>
                  } 
                  id="tab-1"
                />
                <Tab 
                  label={
                    <Badge 
                      badgeContent={invoices.filter(inv => inv.exported).length} 
                      color="success"
                    >
                      Published
                    </Badge>
                  } 
                  id="tab-2"
                />
              </Tabs>
            </Box>

            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
              <TextField
                placeholder="Search invoices..."
                variant="outlined"
                size="small"
                fullWidth
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
                sx={{ mr: 2 }}
              />
              <Button 
                variant="outlined" 
                onClick={handleOpenFilterDialog}
                startIcon={<FilterIcon />}
              >
                Filter
              </Button>
            </Box>

            {loading ? (
              <Box display="flex" justifyContent="center" sx={{ my: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredInvoices.length > 0 ? (
              viewMode === 'list' ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice No</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Buyer</TableCell>
                        <TableCell>Seller GSTIN</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>{invoice.invoice_no}</TableCell>
                          <TableCell>{formatDate(invoice.date)}</TableCell>
                          <TableCell>{invoice.buyer_name}</TableCell>
                          <TableCell>{invoice.seller_gstin}</TableCell>
                          <TableCell align="right">{formatCurrency(invoice.total_value)}</TableCell>
                          <TableCell>
                            {invoice.exported ? (
                              <Chip size="small" label="Published" color="success" />
                            ) : (
                              <Chip size="small" label="Pending" color="warning" />
                            )}
                          </TableCell>
                          <TableCell>
                            <IconButton 
                              size="small" 
                              onClick={(e) => handleOpenActionMenu(e, invoice.id)}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Grid container spacing={3}>
                  {filteredInvoices.map((invoice) => (
                    <Grid item xs={12} sm={6} md={4} key={invoice.id}>
                      <Card>
                        <CardContent>
                          <Typography variant="subtitle1" color="primary" gutterBottom>
                            {invoice.invoice_no}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Date: {formatDate(invoice.date)}
                          </Typography>
                          <Typography variant="body2">
                            Buyer: {invoice.buyer_name}
                          </Typography>
                          <Typography variant="h6" sx={{ mt: 2 }}>
                            {formatCurrency(invoice.total_value)}
                          </Typography>
                          
                          {invoice.exported && (
                            <Chip 
                              size="small" 
                              label="Published" 
                              color="success" 
                              sx={{ mt: 1 }} 
                            />
                          )}
                        </CardContent>
                        <CardActions>
                          <Button 
                            size="small" 
                            startIcon={<QrCodeIcon />}
                            onClick={() => handleViewQRCode(invoice.id)}
                          >
                            QR
                          </Button>
                          <Button 
                            size="small" 
                            startIcon={<FileDownloadIcon />}
                            onClick={() => handleExportJSON(invoice.id)}
                          >
                            JSON
                          </Button>
                          <Button 
                            size="small" 
                            startIcon={<EditIcon />}
                            onClick={() => handleEditInvoice(invoice.id)}
                          >
                            Edit
                          </Button>
                          <IconButton 
                            size="small"
                            onClick={(e) => handleOpenActionMenu(e, invoice.id)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )
            ) : (
              <Alert severity="info">
                No invoices found. Create some invoices first.
              </Alert>
            )}
          </Paper>
        )}
      </Container>

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleCloseActionMenu}
      >
        <MenuItem onClick={() => { handleViewQRCode(selectedInvoiceId) }}>
          <QrCodeIcon fontSize="small" sx={{ mr: 1 }} />
          View QR Code
        </MenuItem>
        <MenuItem onClick={() => { handleExportJSON(selectedInvoiceId); handleCloseActionMenu(); }}>
          <FileDownloadIcon fontSize="small" sx={{ mr: 1 }} />
          Export JSON
        </MenuItem>
        <MenuItem onClick={handleCloseActionMenu}>
          <PrintIcon fontSize="small" sx={{ mr: 1 }} />
          Print Invoice
        </MenuItem>
        <MenuItem onClick={() => { handleEditInvoice(selectedInvoiceId) }}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit Invoice
        </MenuItem>
        {invoices.find(inv => inv.id === selectedInvoiceId)?.exported === false && (
          <MenuItem onClick={() => { setSelectedInvoiceId(selectedInvoiceId); setMarkAsPublishedDialog(true); handleCloseActionMenu(); }}>
            <CheckCircleOutlineIcon fontSize="small" sx={{ mr: 1 }} />
            Mark as Published
          </MenuItem>
        )}
        <MenuItem onClick={handleOpenDeleteDialog}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete Invoice
        </MenuItem>
      </Menu>

      {/* Filter Dialog */}
      <Dialog open={filterDialog} onClose={handleCloseFilterDialog}>
        <DialogTitle>Filter Invoices</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Select filters to narrow down your invoice list:
          </DialogContentText>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Date Range</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="From"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="To"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFilterDialog}>Cancel</Button>
          <Button 
            onClick={handleCloseFilterDialog} 
            variant="contained"
          >
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark as Published Dialog */}
      <Dialog open={markAsPublishedDialog} onClose={() => setMarkAsPublishedDialog(false)}>
        <DialogTitle>Mark Invoice as Published</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to mark this invoice as published to the GST portal? 
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarkAsPublishedDialog(false)}>Cancel</Button>
          <Button 
            onClick={() => handleMarkInvoicePublished(selectedInvoiceId)} 
            variant="contained"
          >
            Mark as Published
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Invoice</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this invoice? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button 
            onClick={() => handleDeleteInvoice(selectedInvoiceId)} 
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default Dashboard; 