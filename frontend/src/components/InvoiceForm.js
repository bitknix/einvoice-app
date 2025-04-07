import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { generateInvoice } from '../utils/api';
import { QRCodeSVG } from 'qrcode.react';

// Material UI components
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Divider,
  IconButton,
  AppBar,
  Toolbar,
  Alert,
  Snackbar,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Calculate as CalculateIcon
} from '@mui/icons-material';

// Validation schema
const schema = yup.object({
  sellerGstin: yup.string()
    .required('Seller GSTIN is required')
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format'),
  sellerName: yup.string().required('Seller name is required'),
  sellerAddress1: yup.string().required('Address line 1 is required'),
  sellerCity: yup.string().required('City is required'),
  sellerPin: yup.number().typeError('PIN must be a number').required('PIN is required'),
  sellerState: yup.string().required('State code is required'),
  
  invoiceNo: yup.string().required('Invoice number is required'),
  invoiceDate: yup.string().required('Invoice date is required'),
  
  buyerGstin: yup.string().required('Buyer GSTIN is required'),
  buyerName: yup.string().required('Buyer name is required'),
  buyerAddress1: yup.string().required('Address line 1 is required'),
  buyerCity: yup.string().required('City is required'),
  buyerPin: yup.number().typeError('PIN must be a number').required('PIN is required'),
  buyerState: yup.string().required('State code is required'),
  
  items: yup.array().of(
    yup.object().shape({
      description: yup.string().required('Description is required'),
      hsnCode: yup.string().required('HSN code is required'),
      quantity: yup.number().typeError('Quantity must be a number').positive('Quantity must be positive').required('Quantity is required'),
      unit: yup.string().required('Unit is required'),
      unitPrice: yup.number().typeError('Unit price must be a number').positive('Unit price must be positive').required('Unit price is required'),
      gstRate: yup.number().typeError('GST rate must be a number').min(0, 'GST rate must be 0 or higher').required('GST rate is required')
    })
  ).min(1, 'At least one item is required')
});

// Helper function to format current date
const formatDate = () => {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

function InvoiceForm() {
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [showQRDialog, setShowQRDialog] = useState(false);
  
  const { register, handleSubmit, control, formState: { errors }, watch, setValue } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      sellerGstin: '',
      sellerName: '',
      sellerAddress1: '',
      sellerAddress2: '',
      sellerCity: '',
      sellerPin: '',
      sellerState: '',
      
      invoiceNo: '',
      invoiceDate: formatDate(),
      
      buyerGstin: 'URP', // Default for unregistered person
      buyerName: '',
      buyerAddress1: '',
      buyerAddress2: '',
      buyerCity: '',
      buyerPin: '999999',
      buyerState: '96', // Default for exports
      
      items: [
        {
          description: '',
          hsnCode: '',
          quantity: '',
          unit: '',
          unitPrice: '',
          gstRate: '5'
        }
      ]
    }
  });
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });
  
  const formValues = watch();
  
  const calculateTotals = () => {
    // Calculate totals for each item and the invoice
    let totalAssessableValue = 0;
    let totalIgstValue = 0;
    
    formValues.items.forEach((item, index) => {
      if (item.quantity && item.unitPrice) {
        const totalAmount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
        setValue(`items.${index}.totalAmount`, totalAmount.toFixed(2));
        
        const igstAmount = totalAmount * (parseFloat(item.gstRate) / 100);
        setValue(`items.${index}.igstAmount`, igstAmount.toFixed(2));
        
        const totalItemValue = totalAmount + igstAmount;
        setValue(`items.${index}.totalItemValue`, totalItemValue.toFixed(2));
        
        totalAssessableValue += totalAmount;
        totalIgstValue += igstAmount;
      }
    });
    
    setValue('totalAssessableValue', totalAssessableValue.toFixed(2));
    setValue('totalIgstValue', totalIgstValue.toFixed(2));
    setValue('totalInvoiceValue', (totalAssessableValue + totalIgstValue).toFixed(2));
  };
  
  const onSubmit = async (data) => {
    setIsLoading(true);
    setError('');
    calculateTotals();
    
    try {
      // Build invoice object according to API schema
      const invoiceData = [{
        Version: "1.1",
        TranDtls: {
          TaxSch: "GST",
          SupTyp: "EXPWP",
          RegRev: "N"
        },
        DocDtls: {
          Typ: "INV",
          No: data.invoiceNo,
          Dt: data.invoiceDate
        },
        SellerDtls: {
          Gstin: data.sellerGstin,
          LglNm: data.sellerName,
          TrdNm: data.sellerName,
          Addr1: data.sellerAddress1,
          Addr2: data.sellerAddress2 || '',
          Loc: data.sellerCity,
          Pin: parseInt(data.sellerPin),
          Stcd: data.sellerState
        },
        BuyerDtls: {
          Gstin: data.buyerGstin,
          LglNm: data.buyerName,
          TrdNm: data.buyerName,
          Pos: data.buyerState,
          Addr1: data.buyerAddress1,
          Addr2: data.buyerAddress2 || '',
          Loc: data.buyerCity,
          Pin: parseInt(data.buyerPin),
          Stcd: data.buyerState
        },
        ItemList: data.items.map((item, index) => ({
          SlNo: (index + 1).toString(),
          PrdDesc: item.description,
          IsServc: "N",
          HsnCd: item.hsnCode,
          Qty: parseFloat(item.quantity),
          Unit: item.unit,
          UnitPrice: parseFloat(item.unitPrice),
          TotAmt: parseFloat(item.quantity) * parseFloat(item.unitPrice),
          AssAmt: parseFloat(item.quantity) * parseFloat(item.unitPrice),
          GstRt: parseFloat(item.gstRate),
          IgstAmt: (parseFloat(item.quantity) * parseFloat(item.unitPrice)) * (parseFloat(item.gstRate) / 100),
          TotItemVal: (parseFloat(item.quantity) * parseFloat(item.unitPrice)) * (1 + (parseFloat(item.gstRate) / 100))
        })),
        ValDtls: {
          AssVal: parseFloat(data.totalAssessableValue || 0),
          IgstVal: parseFloat(data.totalIgstValue || 0),
          TotInvVal: parseFloat(data.totalInvoiceValue || 0)
        },
        ExpDtls: {
          ForCur: null,
          CntCode: null
        }
      }];
      
      const response = await generateInvoice(invoiceData);
      setInvoiceResult(response.data);
      setSuccessMessage('Invoice generated successfully!');
      setIsLoading(false);
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.error || 'Failed to generate invoice');
      } else {
        setError('An error occurred. Please try again.');
      }
      setIsLoading(false);
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
            Generate GST Invoice
          </Typography>
          <Button
            color="inherit"
            startIcon={<CalculateIcon />}
            onClick={calculateTotals}
          >
            Calculate Totals
          </Button>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4, mb: 4 }}>
        {/* Success message */}
        <Snackbar
          open={!!successMessage}
          autoHideDuration={6000}
          onClose={() => setSuccessMessage('')}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert onClose={() => setSuccessMessage('')} severity="success">
            {successMessage}
          </Alert>
        </Snackbar>
        
        {/* Error message */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {/* Invoice result */}
        {invoiceResult && (
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Invoice Generated Successfully
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2">
                    <strong>Invoice No:</strong> {invoiceResult.invoices[0].invoice_no}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={() => setShowQRDialog(true)}
                  >
                    View QR Code
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}
        
        {/* QR Code Dialog */}
        <Dialog open={showQRDialog} onClose={() => setShowQRDialog(false)}>
          <DialogTitle>Invoice QR Code</DialogTitle>
          <DialogContent sx={{ textAlign: 'center' }}>
            {invoiceResult && (
              <>
                <QRCodeSVG 
                  value={`${window.location.origin}${invoiceResult.invoices[0].qr_url}`} 
                  size={256} 
                  level="H"
                />
                <Typography variant="body2" sx={{ mt: 2 }}>
                  Invoice No: {invoiceResult.invoices[0].invoice_no}
                </Typography>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowQRDialog(false)}>Close</Button>
            <Button 
              variant="contained" 
              onClick={() => window.open(invoiceResult?.invoices[0]?.qr_url, '_blank')}
            >
              Open Full Size
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Invoice form */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            {/* Seller details */}
            <Typography variant="h6" gutterBottom>
              Seller Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="GSTIN *"
                  fullWidth
                  margin="normal"
                  {...register('sellerGstin')}
                  error={!!errors.sellerGstin}
                  helperText={errors.sellerGstin?.message}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Legal Name *"
                  fullWidth
                  margin="normal"
                  {...register('sellerName')}
                  error={!!errors.sellerName}
                  helperText={errors.sellerName?.message}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Address Line 1 *"
                  fullWidth
                  margin="normal"
                  {...register('sellerAddress1')}
                  error={!!errors.sellerAddress1}
                  helperText={errors.sellerAddress1?.message}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Address Line 2"
                  fullWidth
                  margin="normal"
                  {...register('sellerAddress2')}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="City *"
                  fullWidth
                  margin="normal"
                  {...register('sellerCity')}
                  error={!!errors.sellerCity}
                  helperText={errors.sellerCity?.message}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="PIN Code *"
                  fullWidth
                  margin="normal"
                  {...register('sellerPin')}
                  error={!!errors.sellerPin}
                  helperText={errors.sellerPin?.message}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="State Code *"
                  fullWidth
                  margin="normal"
                  placeholder="e.g. 07 for Delhi"
                  {...register('sellerState')}
                  error={!!errors.sellerState}
                  helperText={errors.sellerState?.message}
                  disabled={isLoading}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Invoice details */}
            <Typography variant="h6" gutterBottom>
              Invoice Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Invoice Number *"
                  fullWidth
                  margin="normal"
                  {...register('invoiceNo')}
                  error={!!errors.invoiceNo}
                  helperText={errors.invoiceNo?.message}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Invoice Date *"
                  fullWidth
                  margin="normal"
                  placeholder="DD/MM/YYYY"
                  {...register('invoiceDate')}
                  error={!!errors.invoiceDate}
                  helperText={errors.invoiceDate?.message}
                  disabled={isLoading}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Buyer details */}
            <Typography variant="h6" gutterBottom>
              Buyer Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="GSTIN *"
                  fullWidth
                  margin="normal"
                  {...register('buyerGstin')}
                  error={!!errors.buyerGstin}
                  helperText={errors.buyerGstin?.message}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Legal Name *"
                  fullWidth
                  margin="normal"
                  {...register('buyerName')}
                  error={!!errors.buyerName}
                  helperText={errors.buyerName?.message}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Address Line 1 *"
                  fullWidth
                  margin="normal"
                  {...register('buyerAddress1')}
                  error={!!errors.buyerAddress1}
                  helperText={errors.buyerAddress1?.message}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Address Line 2"
                  fullWidth
                  margin="normal"
                  {...register('buyerAddress2')}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="City *"
                  fullWidth
                  margin="normal"
                  {...register('buyerCity')}
                  error={!!errors.buyerCity}
                  helperText={errors.buyerCity?.message}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="PIN Code *"
                  fullWidth
                  margin="normal"
                  {...register('buyerPin')}
                  error={!!errors.buyerPin}
                  helperText={errors.buyerPin?.message}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="State Code *"
                  fullWidth
                  margin="normal"
                  placeholder="e.g. 96 for exports"
                  {...register('buyerState')}
                  error={!!errors.buyerState}
                  helperText={errors.buyerState?.message}
                  disabled={isLoading}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Item list */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Items
              </Typography>
              <Button
                startIcon={<AddIcon />}
                variant="outlined"
                onClick={() => append({
                  description: '',
                  hsnCode: '',
                  quantity: '',
                  unit: '',
                  unitPrice: '',
                  gstRate: '5'
                })}
                disabled={isLoading}
              >
                Add Item
              </Button>
            </Box>

            {fields.map((field, index) => (
              <Paper 
                key={field.id} 
                elevation={1} 
                sx={{ p: 2, mb: 2, bgcolor: '#f9f9f9' }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1">
                    Item #{index + 1}
                  </Typography>
                  {fields.length > 1 && (
                    <IconButton 
                      color="error" 
                      onClick={() => remove(index)}
                      disabled={isLoading}
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Description *"
                      fullWidth
                      {...register(`items.${index}.description`)}
                      error={!!errors.items?.[index]?.description}
                      helperText={errors.items?.[index]?.description?.message}
                      disabled={isLoading}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="HSN Code *"
                      fullWidth
                      {...register(`items.${index}.hsnCode`)}
                      error={!!errors.items?.[index]?.hsnCode}
                      helperText={errors.items?.[index]?.hsnCode?.message}
                      disabled={isLoading}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Quantity *"
                      fullWidth
                      type="number"
                      InputProps={{ inputProps: { min: 0, step: "0.01" } }}
                      {...register(`items.${index}.quantity`)}
                      error={!!errors.items?.[index]?.quantity}
                      helperText={errors.items?.[index]?.quantity?.message}
                      disabled={isLoading}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Unit *"
                      fullWidth
                      placeholder="e.g. PCS, KG, MTR"
                      {...register(`items.${index}.unit`)}
                      error={!!errors.items?.[index]?.unit}
                      helperText={errors.items?.[index]?.unit?.message}
                      disabled={isLoading}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Unit Price *"
                      fullWidth
                      type="number"
                      InputProps={{ inputProps: { min: 0, step: "0.01" } }}
                      {...register(`items.${index}.unitPrice`)}
                      error={!!errors.items?.[index]?.unitPrice}
                      helperText={errors.items?.[index]?.unitPrice?.message}
                      disabled={isLoading}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="GST Rate (%) *"
                      fullWidth
                      type="number"
                      InputProps={{ inputProps: { min: 0, step: "0.01" } }}
                      {...register(`items.${index}.gstRate`)}
                      error={!!errors.items?.[index]?.gstRate}
                      helperText={errors.items?.[index]?.gstRate?.message}
                      disabled={isLoading}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Total Amount"
                      fullWidth
                      InputProps={{ readOnly: true }}
                      value={
                        formValues.items[index]?.quantity && formValues.items[index]?.unitPrice
                          ? (parseFloat(formValues.items[index].quantity) * parseFloat(formValues.items[index].unitPrice)).toFixed(2)
                          : '0.00'
                      }
                      disabled
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="IGST Amount"
                      fullWidth
                      InputProps={{ readOnly: true }}
                      value={
                        formValues.items[index]?.quantity && formValues.items[index]?.unitPrice && formValues.items[index]?.gstRate
                          ? ((parseFloat(formValues.items[index].quantity) * parseFloat(formValues.items[index].unitPrice)) * 
                              (parseFloat(formValues.items[index].gstRate) / 100)).toFixed(2)
                          : '0.00'
                      }
                      disabled
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Total Value"
                      fullWidth
                      InputProps={{ readOnly: true }}
                      value={
                        formValues.items[index]?.quantity && formValues.items[index]?.unitPrice && formValues.items[index]?.gstRate
                          ? ((parseFloat(formValues.items[index].quantity) * parseFloat(formValues.items[index].unitPrice)) * 
                              (1 + (parseFloat(formValues.items[index].gstRate) / 100))).toFixed(2)
                          : '0.00'
                      }
                      disabled
                    />
                  </Grid>
                </Grid>
              </Paper>
            ))}

            <Divider sx={{ my: 3 }} />

            {/* Totals */}
            <Typography variant="h6" gutterBottom>
              Invoice Totals
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Total Assessable Value"
                  fullWidth
                  margin="normal"
                  InputProps={{ readOnly: true }}
                  {...register('totalAssessableValue')}
                  disabled
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Total IGST Value"
                  fullWidth
                  margin="normal"
                  InputProps={{ readOnly: true }}
                  {...register('totalIgstValue')}
                  disabled
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Total Invoice Value"
                  fullWidth
                  margin="normal"
                  InputProps={{ readOnly: true }}
                  {...register('totalInvoiceValue')}
                  disabled
                />
              </Grid>
            </Grid>

            {/* Submit button */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                color="primary"
                type="submit"
                size="large"
                disabled={isLoading}
              >
                {isLoading ? 'Generating Invoice...' : 'Generate Invoice'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    </>
  );
}

export default InvoiceForm; 