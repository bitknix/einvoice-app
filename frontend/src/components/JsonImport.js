import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { importJSON } from '../utils/api';

// Material UI components
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Alert,
  AlertTitle,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  FileUpload as FileUploadIcon,
  Home as HomeIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { removeToken, getUserInfo } from '../utils/auth';
import { useNavigate } from 'react-router-dom';

function JsonImport() {
  const navigate = useNavigate();
  const [jsonContent, setJsonContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [userInfo, setUserInfo] = useState(getUserInfo());

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

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setError('');
    setSuccess(false);

    // Check file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Please upload a JSON file');
      return;
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        // Validate JSON format
        JSON.parse(content);
        setJsonContent(content);
      } catch (err) {
        setError('Invalid JSON format');
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!jsonContent) {
      setError('Please upload a JSON file');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Parse JSON to ensure valid format
      let parsedJSON = JSON.parse(jsonContent);
      
      // Unwrap if it's an array with a single item
      if (Array.isArray(parsedJSON) && parsedJSON.length === 1) {
        parsedJSON = parsedJSON[0];
      }
      
      // Check if it's a GST-compliant JSON
      if (!isValidGSTJson(parsedJSON)) {
        setError('The JSON does not appear to be in the GST-compliant format. Please check your file.');
        setLoading(false);
        return;
      }

      // Send to server
      const response = await importJSON(parsedJSON);
      
      setSuccess(true);
      setJsonContent('');
      setFileName('');
    } catch (err) {
      let errorMsg = err.response?.data?.error || 'Failed to import JSON invoice';
      if (errorMsg.includes('cannot unmarshal')) {
        errorMsg = 'Invalid JSON structure. Make sure your JSON follows the GST e-Invoice schema.';
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to validate if JSON looks like a GST Invoice
  const isValidGSTJson = (json) => {
    // If it's an array, check the first item
    if (Array.isArray(json)) {
      if (json.length === 0) return false;
      json = json[0]; // Check first element
    }
    
    // Basic structure check for GST Invoice
    return (
      json && 
      typeof json === 'object' &&
      (json.Version !== undefined || json.TranDtls !== undefined || json.DocDtls !== undefined)
    );
  };

  const handlePasteJson = (event) => {
    const pastedContent = event.target.value;
    setJsonContent(pastedContent);
    
    try {
      // Validate JSON format
      if (pastedContent) {
        JSON.parse(pastedContent);
        setError('');
      }
    } catch (err) {
      if (pastedContent) {
        setError('Invalid JSON format: ' + err.message);
      }
    }
  };

  return (
    <>
      {/* App bar */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Import GST JSON Invoice
          </Typography>
          <Button 
            color="inherit" 
            component={Link} 
            to="/dashboard"
            startIcon={<HomeIcon />}
          >
            Dashboard
          </Button>
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

      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            Import Indian GST-Compliant JSON Invoice
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Upload or paste a GST-compliant JSON invoice file that follows the NIC's official e-Invoice schema.
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <AlertTitle>Error</AlertTitle>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              <AlertTitle>Success</AlertTitle>
              Invoice imported successfully!
            </Alert>
          )}
          
          <form onSubmit={handleSubmit}>
            <Box sx={{ mb: 3 }}>
              <Button
                variant="contained"
                component="label"
                startIcon={<FileUploadIcon />}
                disabled={loading}
              >
                Upload JSON File
                <input
                  type="file"
                  accept=".json"
                  hidden
                  onChange={handleFileChange}
                />
              </Button>
              {fileName && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Selected file: {fileName}
                </Typography>
              )}
            </Box>
            
            <Divider sx={{ my: 3 }}>OR</Divider>
            
            <TextField
              label="Paste JSON Content"
              multiline
              rows={10}
              fullWidth
              value={jsonContent}
              onChange={handlePasteJson}
              variant="outlined"
              placeholder="Paste your GST-compliant JSON invoice here"
              sx={{ mb: 3 }}
            />
            
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading || !jsonContent}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Import Invoice'}
            </Button>
          </form>
        </Paper>
      </Container>
    </>
  );
}

export default JsonImport; 