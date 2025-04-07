import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getInvoiceById, updateInvoice } from '../utils/api';
import { removeToken, getUserInfo } from '../utils/auth';

// Material UI components
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Divider,
  Grid,
  IconButton,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
  Select,
  FormControl,
  InputLabel,
  FormHelperText
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon
} from '@mui/icons-material';

function EditInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [userInfo, setUserInfo] = useState(getUserInfo());
  const [deleteItemDialogOpen, setDeleteItemDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Fetch invoice details
  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoading(true);
        const response = await getInvoiceById(id);
        setInvoice(response.data.invoice);
        setLoading(false);
      } catch (err) {
        setError('Failed to load invoice details');
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  const handleOpenUserMenu = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setUserMenuAnchor(null);
  };

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  const handleSaveInvoice = async () => {
    try {
      setSaving(true);
      
      // Recalculate totals before saving
      calculateTotals();
      
      await updateInvoice(id, invoice);
      setSuccess(true);
      setSaving(false);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save invoice');
      setSaving(false);
    }
  };

  const handleOpenDeleteDialog = (index) => {
    setItemToDelete(index);
    setDeleteItemDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteItemDialogOpen(false);
    setItemToDelete(null);
  };

  const handleDeleteItem = () => {
    if (itemToDelete !== null && invoice) {
      const updatedItems = [...invoice.ItemList];
      updatedItems.splice(itemToDelete, 1);
      
      // Update serial numbers
      updatedItems.forEach((item, idx) => {
        item.SlNo = (idx + 1).toString();
      });
      
      setInvoice({
        ...invoice,
        ItemList: updatedItems
      });
      
      handleCloseDeleteDialog();
    }
  };

  const handleAddItem = () => {
    if (invoice) {
      const newItem = {
        SlNo: (invoice.ItemList.length + 1).toString(),
        PrdDesc: "",
        IsServc: "N",
        HsnCd: "",
        Qty: 1,
        Unit: "PCS",
        UnitPrice: 0,
        TotAmt: 0,
        AssAmt: 0,
        GstRt: 18,
        IgstAmt: 0,
        TotItemVal: 0
      };
      
      setInvoice({
        ...invoice,
        ItemList: [...invoice.ItemList, newItem]
      });
    }
  };

  const handleItemChange = (index, field, value) => {
    if (invoice) {
      const updatedItems = [...invoice.ItemList];
      
      // Convert numeric fields
      if (['Qty', 'UnitPrice', 'GstRt'].includes(field)) {
        value = parseFloat(value) || 0;
      }
      
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value
      };
      
      // Calculate item totals
      if (['Qty', 'UnitPrice', 'GstRt'].includes(field)) {
        const item = updatedItems[index];
        item.TotAmt = item.Qty * item.UnitPrice;
        item.AssAmt = item.TotAmt;
        item.IgstAmt = item.AssAmt * item.GstRt / 100;
        item.TotItemVal = item.AssAmt + item.IgstAmt;
      }
      
      setInvoice({
        ...invoice,
        ItemList: updatedItems
      });
    }
  };

  const handleSellerChange = (field, value) => {
    if (invoice) {
      setInvoice({
        ...invoice,
        SellerDtls: {
          ...invoice.SellerDtls,
          [field]: field === 'Pin' ? parseInt(value) || 0 : value
        }
      });
    }
  };

  const handleBuyerChange = (field, value) => {
    if (invoice) {
      setInvoice({
        ...invoice,
        BuyerDtls: {
          ...invoice.BuyerDtls,
          [field]: field === 'Pin' ? parseInt(value) || 0 : value
        }
      });
    }
  };

  const handleDocChange = (field, value) => {
    if (invoice) {
      setInvoice({
        ...invoice,
        DocDtls: {
          ...invoice.DocDtls,
          [field]: value
        }
      });
    }
  };

  const calculateTotals = () => {
    if (invoice) {
      let totalAssVal = 0;
      let totalIgstVal = 0;
      
      const updatedItems = invoice.ItemList.map(item => {
        // Recalculate each item
        const totAmt = item.Qty * item.UnitPrice;
        const assAmt = totAmt;
        const igstAmt = assAmt * item.GstRt / 100;
        const totItemVal = assAmt + igstAmt;
        
        // Add to invoice totals
        totalAssVal += assAmt;
        totalIgstVal += igstAmt;
        
        return {
          ...item,
          TotAmt: totAmt,
          AssAmt: assAmt,
          IgstAmt: igstAmt,
          TotItemVal: totItemVal
        };
      });
      
      setInvoice({
        ...invoice,
        ItemList: updatedItems,
        ValDtls: {
          ...invoice.ValDtls,
          AssVal: totalAssVal,
          IgstVal: totalIgstVal,
          TotInvVal: totalAssVal + totalIgstVal
        }
      });
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!invoice && !loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">Invoice not found or failed to load</Alert>
        <Button 
          component={Link} 
          to="/dashboard"
          variant="contained" 
          sx={{ mt: 2 }}
        >
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Button 
            color="inherit" 
            component={Link} 
            to="/dashboard"
            startIcon={<ArrowBackIcon />}
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Edit Invoice
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

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Invoice saved successfully
          </Alert>
        )}
        
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>Invoice Details</Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Invoice Number"
                fullWidth
                value={invoice.DocDtls.No}
                onChange={(e) => handleDocChange('No', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Invoice Date"
                fullWidth
                value={invoice.DocDtls.Dt}
                onChange={(e) => handleDocChange('Dt', e.target.value)}
                margin="normal"
                placeholder="DD/MM/YYYY"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Invoice Type</InputLabel>
                <Select
                  value={invoice.DocDtls.Typ}
                  onChange={(e) => handleDocChange('Typ', e.target.value)}
                  label="Invoice Type"
                >
                  <MenuItem value="INV">Regular Invoice</MenuItem>
                  <MenuItem value="CRN">Credit Note</MenuItem>
                  <MenuItem value="DBN">Debit Note</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
        
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>Seller Details</Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="GSTIN"
                fullWidth
                value={invoice.SellerDtls.Gstin}
                onChange={(e) => handleSellerChange('Gstin', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Legal Name"
                fullWidth
                value={invoice.SellerDtls.LglNm}
                onChange={(e) => handleSellerChange('LglNm', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Trade Name"
                fullWidth
                value={invoice.SellerDtls.TrdNm}
                onChange={(e) => handleSellerChange('TrdNm', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Address Line 1"
                fullWidth
                value={invoice.SellerDtls.Addr1}
                onChange={(e) => handleSellerChange('Addr1', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Address Line 2"
                fullWidth
                value={invoice.SellerDtls.Addr2}
                onChange={(e) => handleSellerChange('Addr2', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Location"
                fullWidth
                value={invoice.SellerDtls.Loc}
                onChange={(e) => handleSellerChange('Loc', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="PIN Code"
                fullWidth
                value={invoice.SellerDtls.Pin}
                onChange={(e) => handleSellerChange('Pin', e.target.value)}
                margin="normal"
                type="number"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="State Code"
                fullWidth
                value={invoice.SellerDtls.Stcd}
                onChange={(e) => handleSellerChange('Stcd', e.target.value)}
                margin="normal"
              />
            </Grid>
          </Grid>
        </Paper>
        
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>Buyer Details</Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="GSTIN"
                fullWidth
                value={invoice.BuyerDtls.Gstin}
                onChange={(e) => handleBuyerChange('Gstin', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Legal Name"
                fullWidth
                value={invoice.BuyerDtls.LglNm}
                onChange={(e) => handleBuyerChange('LglNm', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Trade Name"
                fullWidth
                value={invoice.BuyerDtls.TrdNm}
                onChange={(e) => handleBuyerChange('TrdNm', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Place of Supply"
                fullWidth
                value={invoice.BuyerDtls.Pos}
                onChange={(e) => handleBuyerChange('Pos', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Address Line 1"
                fullWidth
                value={invoice.BuyerDtls.Addr1}
                onChange={(e) => handleBuyerChange('Addr1', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Address Line 2"
                fullWidth
                value={invoice.BuyerDtls.Addr2}
                onChange={(e) => handleBuyerChange('Addr2', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Location"
                fullWidth
                value={invoice.BuyerDtls.Loc}
                onChange={(e) => handleBuyerChange('Loc', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="PIN Code"
                fullWidth
                value={invoice.BuyerDtls.Pin}
                onChange={(e) => handleBuyerChange('Pin', e.target.value)}
                margin="normal"
                type="number"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="State Code"
                fullWidth
                value={invoice.BuyerDtls.Stcd}
                onChange={(e) => handleBuyerChange('Stcd', e.target.value)}
                margin="normal"
              />
            </Grid>
          </Grid>
        </Paper>
        
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h5">Items</Typography>
            <Button 
              startIcon={<AddIcon />} 
              variant="contained"
              onClick={handleAddItem}
            >
              Add Item
            </Button>
          </Box>
          
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>HSN Code</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell>Rate (₹)</TableCell>
                <TableCell>GST Rate (%)</TableCell>
                <TableCell>Amount (₹)</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoice.ItemList.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.SlNo}</TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      value={item.PrdDesc}
                      onChange={(e) => handleItemChange(index, 'PrdDesc', e.target.value)}
                      variant="standard"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      value={item.HsnCd}
                      onChange={(e) => handleItemChange(index, 'HsnCd', e.target.value)}
                      variant="standard"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={item.Qty}
                      onChange={(e) => handleItemChange(index, 'Qty', e.target.value)}
                      variant="standard"
                      InputProps={{
                        inputProps: { min: 0, step: 'any' }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={item.Unit}
                      onChange={(e) => handleItemChange(index, 'Unit', e.target.value)}
                      variant="standard"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={item.UnitPrice}
                      onChange={(e) => handleItemChange(index, 'UnitPrice', e.target.value)}
                      variant="standard"
                      InputProps={{
                        inputProps: { min: 0, step: 'any' }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={item.GstRt}
                      onChange={(e) => handleItemChange(index, 'GstRt', e.target.value)}
                      variant="standard"
                      InputProps={{
                        inputProps: { min: 0, step: 'any' }
                      }}
                    />
                  </TableCell>
                  <TableCell>{formatCurrency(item.TotItemVal)}</TableCell>
                  <TableCell>
                    <IconButton 
                      size="small" 
                      color="error"
                      onClick={() => handleOpenDeleteDialog(index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2">Total Taxable Value</Typography>
                <Typography variant="h6">{formatCurrency(invoice.ValDtls.AssVal)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2">Total Tax</Typography>
                <Typography variant="h6">{formatCurrency(invoice.ValDtls.IgstVal)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2">Total Invoice Value</Typography>
                <Typography variant="h6">{formatCurrency(invoice.ValDtls.TotInvVal)}</Typography>
              </Grid>
            </Grid>
          </Box>
        </Paper>
        
        <Box display="flex" justifyContent="flex-end" sx={{ mb: 4 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<SaveIcon />}
            onClick={handleSaveInvoice}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Invoice'}
          </Button>
        </Box>
      </Container>

      {/* Delete Item Confirmation Dialog */}
      <Dialog
        open={deleteItemDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this item? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleDeleteItem} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default EditInvoice; 