import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { removeToken, getUserInfo } from '../utils/auth';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../utils/api';

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
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Fab
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

function Suppliers() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [userInfo, setUserInfo] = useState(getUserInfo());
  const [openDialog, setOpenDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);

  const emptySupplier = {
    name: "",
    gstin: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    email: ""
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await getSuppliers();
      setSuppliers(response.data.suppliers || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to load suppliers');
      setSuppliers([]);
      setLoading(false);
    }
  };

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

  const handleAddSupplier = () => {
    setEditingSupplier({...emptySupplier});
    setOpenDialog(true);
  };

  const handleEditSupplier = (supplier) => {
    setEditingSupplier(supplier);
    setOpenDialog(true);
  };

  const handleDeleteSupplier = (supplier) => {
    setSupplierToDelete(supplier);
    setDeleteConfirmOpen(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingSupplier(null);
  };

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setSupplierToDelete(null);
  };

  const handleSaveSupplier = async () => {
    try {
      if (!editingSupplier) {
        setError('No supplier data to save');
        return;
      }
      
      if (editingSupplier.id) {
        // Update existing supplier
        await updateSupplier(editingSupplier.id, editingSupplier);
        await fetchSuppliers(); // Refresh the list
      } else {
        // Add new supplier
        await createSupplier(editingSupplier);
        await fetchSuppliers(); // Refresh the list
      }
      
      setOpenDialog(false);
      setEditingSupplier(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save supplier');
    }
  };

  const handleSupplierChange = (field, value) => {
    if (!editingSupplier) return;
    
    setEditingSupplier({
      ...editingSupplier,
      [field]: field === 'pincode' ? (value === '' ? 0 : parseInt(value, 10)) : value
    });
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteSupplier(supplierToDelete.id);
      await fetchSuppliers(); // Refresh the list
      setDeleteConfirmOpen(false);
      setSupplierToDelete(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete supplier');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '100vh' }}>
        <CircularProgress />
      </Box>
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
            Manage Suppliers
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
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h5">
            Your Suppliers
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSupplier}
          >
            Add Supplier
          </Button>
        </Box>

        {suppliers && suppliers.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>GSTIN</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>{supplier.name}</TableCell>
                    <TableCell>{supplier.gstin}</TableCell>
                    <TableCell>{supplier.city}</TableCell>
                    <TableCell>{supplier.state}</TableCell>
                    <TableCell>{supplier.phone}</TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        color="primary"
                        onClick={() => handleEditSupplier(supplier)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDeleteSupplier(supplier)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">
            No suppliers found. Add your first supplier to manage your supply chain.
          </Alert>
        )}
      </Container>

      {/* Supplier Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingSupplier?.id ? 'Edit Supplier' : 'Add Supplier'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Supplier Name"
                value={editingSupplier?.name || ''}
                onChange={(e) => handleSupplierChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="GSTIN"
                value={editingSupplier?.gstin || ''}
                onChange={(e) => handleSupplierChange('gstin', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={editingSupplier?.address || ''}
                onChange={(e) => handleSupplierChange('address', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="City"
                value={editingSupplier?.city || ''}
                onChange={(e) => handleSupplierChange('city', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="State"
                value={editingSupplier?.state || ''}
                onChange={(e) => handleSupplierChange('state', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Pincode"
                value={editingSupplier?.pincode || ''}
                onChange={(e) => handleSupplierChange('pincode', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone"
                value={editingSupplier?.phone || ''}
                onChange={(e) => handleSupplierChange('phone', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                value={editingSupplier?.email || ''}
                onChange={(e) => handleSupplierChange('email', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveSupplier} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleCloseDeleteConfirm}
      >
        <DialogTitle>Delete Supplier</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {supplierToDelete?.name}? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteConfirm}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default Suppliers; 