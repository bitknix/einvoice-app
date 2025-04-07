import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getUserInfo, removeToken, getToken } from '../utils/auth';
import { 
  Container, 
  Paper, 
  Typography, 
  Button, 
  Box, 
  CircularProgress, 
  Alert,
  AppBar,
  Toolbar,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';

function QRCodeView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [userInfo, setUserInfo] = useState(getUserInfo());
  const [qrCodeUrl, setQrCodeUrl] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchQRCode = async () => {
      try {
        const token = getToken();
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await fetch(`/api/qr/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch QR code');
        }

        const blob = await response.blob();
        if (isMounted) {
          setQrCodeUrl(URL.createObjectURL(blob));
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchQRCode();

    return () => {
      isMounted = false;
      if (qrCodeUrl) {
        URL.revokeObjectURL(qrCodeUrl);
      }
    };
  }, [id, navigate]);

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

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!qrCodeUrl) {
      setError('QR code not available for download');
      return;
    }
    
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `invoice-qr-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">{error}</Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <>
      <AppBar position="static" className="no-print">
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
            Invoice QR Code
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

      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            GST Invoice QR Code
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Scan this QR code to verify the invoice details
          </Typography>
          
          <Box sx={{ mb: 3, p: 2, border: '1px dashed #ccc' }}>
            {qrCodeUrl ? (
              <img 
                src={qrCodeUrl}
                alt="Invoice QR Code"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            ) : (
              <Typography color="error">QR code could not be loaded</Typography>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }} className="no-print">
            <Button
              variant="contained"
              onClick={handlePrint}
              startIcon={<PrintIcon />}
              disabled={!qrCodeUrl}
            >
              Print
            </Button>
            <Button
              variant="outlined"
              onClick={handleDownload}
              startIcon={<DownloadIcon />}
              disabled={!qrCodeUrl}
            >
              Download
            </Button>
          </Box>
        </Paper>
      </Container>

      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </>
  );
}

export default QRCodeView; 