import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { removeToken, getUserInfo } from '../utils/auth';

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
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
  InputAdornment
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

function Items() {
  const navigate = useNavigate();
  const [items, setItems] = useState([
    {
      id: 1,
      name: "Web Development Services",
      description: "Development of responsive website",
      hsn: "998314",
      unit: "Service",
      price: 10000,
      gstRate: 18,
      type: "service"
    },
    {
      id: 2,
      name: "Laptop",
      description: "Business laptop with 16GB RAM",
      hsn: "847130",
      unit: "Pieces",
      price: 60000,
      gstRate: 18,
      type: "goods"
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [userInfo, setUserInfo] = useState(getUserInfo());
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const gstRates = [0, 3, 5, 12, 18, 28];
  const unitOptions = ["Pieces", "Kilograms", "Meters", "Service", "Hours"];
  
  const emptyItem = {
    name: "",
    description: "",
    hsn: "",
    unit: "Pieces",
    price: 0,
    gstRate: 18,
    type: "goods"
  };

  useEffect(() => {
    // In a real app, you would fetch items from the backend here
    // For this demo, we're using the hardcoded sample data
    setLoading(false);
  }, []);

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

  const handleAddItem = () => {
    setEditingItem(emptyItem);
    setOpenDialog(true);
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setOpenDialog(true);
  };

  const handleDeleteItem = (item) => {
    setItemToDelete(item);
    setDeleteConfirmOpen(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingItem(null);
  };

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  };

  const handleSaveItem = () => {
    if (editingItem.id) {
      // Update existing item
      setItems(items.map(item => 
        item.id === editingItem.id ? editingItem : item
      ));
    } else {
      // Add new item with temporary ID (in a real app, the backend would assign this)
      const newItem = { 
        ...editingItem,
        id: Date.now() // Use timestamp as temporary ID
      };
      setItems([...items, newItem]);
    }
    
    setOpenDialog(false);
    setEditingItem(null);
  };

  const handleItemChange = (field, value) => {
    setEditingItem({
      ...editingItem,
      [field]: field === 'price' ? parseFloat(value) || 0 : value
    });
  };

  const handleConfirmDelete = () => {
    setItems(items.filter(item => item.id !== itemToDelete.id));
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
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
            Manage Items
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
            Your Items & Services
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
          >
            Add Item
          </Button>
        </Box>

        {items.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>HSN/SAC</TableCell>
                  <TableCell align="right">Price (₹)</TableCell>
                  <TableCell align="right">GST %</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.hsn}</TableCell>
                    <TableCell align="right">{item.price.toFixed(2)}</TableCell>
                    <TableCell align="right">{item.gstRate}%</TableCell>
                    <TableCell>{item.type === 'service' ? 'Service' : 'Goods'}</TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        color="primary"
                        onClick={() => handleEditItem(item)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDeleteItem(item)}
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
            No items found. Add your first item to create invoices.
          </Alert>
        )}
      </Container>

      {/* Item Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingItem?.id ? 'Edit Item' : 'Add Item'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Item Name"
                value={editingItem?.name || ''}
                onChange={(e) => handleItemChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={editingItem?.type || 'goods'}
                  label="Type"
                  onChange={(e) => handleItemChange('type', e.target.value)}
                >
                  <MenuItem value="goods">Goods</MenuItem>
                  <MenuItem value="service">Service</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={editingItem?.description || ''}
                onChange={(e) => handleItemChange('description', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="HSN/SAC Code"
                value={editingItem?.hsn || ''}
                onChange={(e) => handleItemChange('hsn', e.target.value)}
                helperText="Harmonized System of Nomenclature or Service Accounting Code"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={editingItem?.unit || 'Pieces'}
                  label="Unit"
                  onChange={(e) => handleItemChange('unit', e.target.value)}
                >
                  {unitOptions.map(unit => (
                    <MenuItem key={unit} value={unit}>{unit}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Price"
                type="number"
                value={editingItem?.price || ''}
                onChange={(e) => handleItemChange('price', e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>GST Rate</InputLabel>
                <Select
                  value={editingItem?.gstRate || 18}
                  label="GST Rate"
                  onChange={(e) => handleItemChange('gstRate', e.target.value)}
                >
                  {gstRates.map(rate => (
                    <MenuItem key={rate} value={rate}>{rate}%</MenuItem>
                  ))}
                </Select>
                <FormHelperText>Goods and Services Tax Rate</FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveItem} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleCloseDeleteConfirm}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the item "{itemToDelete?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteConfirm}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default Items; 