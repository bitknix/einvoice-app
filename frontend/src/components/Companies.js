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

function Companies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([
    {
      id: 1,
      name: "Sample Company Ltd.",
      gstin: "27AADCS0472N1Z1",
      address: "123 Business Park",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      phone: "9876543210",
      email: "info@samplecompany.com",
      is_default: true
    },
    {
      id: 2,
      name: "Another Enterprise",
      gstin: "07AABCU9603R1ZP",
      address: "456 Industrial Area",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
      phone: "8765432109",
      email: "contact@anotherenterprise.com",
      is_default: false
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [userInfo, setUserInfo] = useState(getUserInfo());
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  
  const emptyCompany = {
    name: "",
    gstin: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    email: "",
    is_default: false
  };

  useEffect(() => {
    // In a real app, you would fetch companies from the backend here
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

  const handleAddCompany = () => {
    setEditingCompany(emptyCompany);
    setOpenDialog(true);
  };

  const handleEditCompany = (company) => {
    setEditingCompany(company);
    setOpenDialog(true);
  };

  const handleDeleteCompany = (company) => {
    setCompanyToDelete(company);
    setDeleteConfirmOpen(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCompany(null);
  };

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setCompanyToDelete(null);
  };

  const handleSaveCompany = () => {
    if (editingCompany.id) {
      // Update existing company
      setCompanies(companies.map(company => 
        company.id === editingCompany.id ? editingCompany : company
      ));
    } else {
      // Add new company with temporary ID (in a real app, the backend would assign this)
      const newCompany = { 
        ...editingCompany,
        id: Date.now() // Use timestamp as temporary ID
      };
      setCompanies([...companies, newCompany]);
    }
    
    setOpenDialog(false);
    setEditingCompany(null);
  };

  const handleCompanyChange = (field, value) => {
    setEditingCompany({
      ...editingCompany,
      [field]: field === 'pincode' ? value.toString() : value
    });
  };

  const handleConfirmDelete = () => {
    setCompanies(companies.filter(company => company.id !== companyToDelete.id));
    setDeleteConfirmOpen(false);
    setCompanyToDelete(null);
  };

  const handleSetDefault = (id) => {
    setCompanies(companies.map(company => ({
      ...company,
      is_default: company.id === id
    })));
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
            Manage Companies
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
            Your Companies
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddCompany}
          >
            Add Company
          </Button>
        </Box>

        {companies.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Default</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>GSTIN</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <input 
                        type="radio" 
                        checked={company.is_default} 
                        onChange={() => handleSetDefault(company.id)} 
                      />
                    </TableCell>
                    <TableCell>{company.name}</TableCell>
                    <TableCell>{company.gstin}</TableCell>
                    <TableCell>{company.city}</TableCell>
                    <TableCell>{company.state}</TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        color="primary"
                        onClick={() => handleEditCompany(company)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDeleteCompany(company)}
                        disabled={company.is_default}
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
            No companies found. Add your first company to create invoices.
          </Alert>
        )}
      </Container>

      {/* Company Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingCompany?.id ? 'Edit Company' : 'Add Company'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Company Name"
                value={editingCompany?.name || ''}
                onChange={(e) => handleCompanyChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="GSTIN"
                value={editingCompany?.gstin || ''}
                onChange={(e) => handleCompanyChange('gstin', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={editingCompany?.address || ''}
                onChange={(e) => handleCompanyChange('address', e.target.value)}
                multiline
                rows={2}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="City"
                value={editingCompany?.city || ''}
                onChange={(e) => handleCompanyChange('city', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="State"
                value={editingCompany?.state || ''}
                onChange={(e) => handleCompanyChange('state', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="PIN Code"
                value={editingCompany?.pincode || ''}
                onChange={(e) => handleCompanyChange('pincode', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone Number"
                value={editingCompany?.phone || ''}
                onChange={(e) => handleCompanyChange('phone', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                value={editingCompany?.email || ''}
                onChange={(e) => handleCompanyChange('email', e.target.value)}
                type="email"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveCompany} variant="contained">Save</Button>
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
            Are you sure you want to delete the company "{companyToDelete?.name}"? This action cannot be undone.
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

export default Companies; 