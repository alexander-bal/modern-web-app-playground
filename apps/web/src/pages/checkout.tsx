import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import noPhoto from '../assets/no-photo.svg';
import { tsr } from '../lib/api-client';

interface AddressFormData {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  phone: string;
}

const emptyAddress: AddressFormData = {
  fullName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  countryCode: 'US',
  phone: '',
};

type ShippingMode = 'saved' | 'new';
type BillingMode = 'saved' | 'new';

export function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState<AddressFormData>(emptyAddress);
  const [billingAddress, setBillingAddress] = useState<AddressFormData>(emptyAddress);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // User overrides — null means "use default derived value"
  const [userShippingMode, setShippingMode] = useState<ShippingMode | null>(null);
  const [userShippingId, setSelectedShippingId] = useState<string | null>(null);
  const [saveShippingAddress, setSaveShippingAddress] = useState(false);
  const [userBillingMode, setBillingMode] = useState<BillingMode | null>(null);
  const [userBillingId, setSelectedBillingId] = useState<string | null>(null);
  const [saveBillingAddress, setSaveBillingAddress] = useState(false);

  const { data: cartData, isPending: cartPending } = tsr.cart.getCart.useQuery({
    queryKey: ['cart'],
  });
  const { data: addressesData } = tsr.addresses.list.useQuery({ queryKey: ['addresses'] });

  const cart = cartData?.status === 200 ? cartData.body : null;
  const savedAddresses = addressesData?.status === 200 ? addressesData.body.addresses : [];

  // Derived: once addresses load, auto-select default; user can override
  const defaultAddress = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0] ?? null;
  const shippingMode: ShippingMode =
    userShippingMode ?? (savedAddresses.length > 0 ? 'saved' : 'new');
  const selectedShippingId = userShippingId ?? defaultAddress?.id ?? null;
  const billingMode: BillingMode = userBillingMode ?? (savedAddresses.length > 0 ? 'saved' : 'new');
  const selectedBillingId = userBillingId ?? defaultAddress?.id ?? null;

  useEffect(() => {
    if (!cartPending && cart && cart.items.length === 0) {
      navigate('/cart');
    }
  }, [cartPending, cart, navigate]);

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (shippingMode === 'saved') {
      if (!selectedShippingId) errors.shippingPicker = 'Please select a shipping address';
    } else {
      if (!shippingAddress.fullName.trim()) errors['shipping.fullName'] = 'Full name is required';
      if (!shippingAddress.addressLine1.trim())
        errors['shipping.addressLine1'] = 'Address is required';
      if (!shippingAddress.city.trim()) errors['shipping.city'] = 'City is required';
      if (!shippingAddress.postalCode.trim())
        errors['shipping.postalCode'] = 'Postal code is required';
      if (!shippingAddress.countryCode.trim() || shippingAddress.countryCode.length !== 2)
        errors['shipping.countryCode'] = 'Valid 2-letter country code is required';
    }

    if (!billingSameAsShipping) {
      if (billingMode === 'saved') {
        if (!selectedBillingId) errors.billingPicker = 'Please select a billing address';
      } else {
        if (!billingAddress.fullName.trim()) errors['billing.fullName'] = 'Full name is required';
        if (!billingAddress.addressLine1.trim())
          errors['billing.addressLine1'] = 'Address is required';
        if (!billingAddress.city.trim()) errors['billing.city'] = 'City is required';
        if (!billingAddress.postalCode.trim())
          errors['billing.postalCode'] = 'Postal code is required';
        if (!billingAddress.countryCode.trim() || billingAddress.countryCode.length !== 2)
          errors['billing.countryCode'] = 'Valid 2-letter country code is required';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildAddress = (addr: AddressFormData) => ({
    fullName: addr.fullName,
    addressLine1: addr.addressLine1,
    addressLine2: addr.addressLine2 || undefined,
    city: addr.city,
    state: addr.state || undefined,
    postalCode: addr.postalCode,
    countryCode: addr.countryCode.toUpperCase(),
    phone: addr.phone || undefined,
  });

  const checkoutMutation = tsr.checkout.checkout.useMutation({
    onSuccess: (response) => {
      if (response.status === 200) {
        queryClient.invalidateQueries({ queryKey: ['cart'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
        navigate(`/orders/${response.body.orderNumber}/confirmation`);
      } else if (response.status === 400) {
        const errorBody = response.body as {
          error?: string;
          issues?: Array<{ path: string[]; message: string }>;
        };
        if (errorBody.issues && Array.isArray(errorBody.issues)) {
          const fieldErrorsMap: Record<string, string> = {};
          for (const issue of errorBody.issues) {
            const path = issue.path.join('.');
            fieldErrorsMap[path] = issue.message;
          }
          setFieldErrors(fieldErrorsMap);
          setError('Please fix the validation errors below.');
        } else {
          setError(errorBody.error || 'Invalid request. Please check your input.');
        }
      } else if (response.status === 422) {
        setError(response.body.error);
      } else if (response.status === 404) {
        setError('Cart not found. Please add items to your cart.');
      } else if (response.status === 401) {
        setError('Please log in to complete your order.');
      } else {
        setError('Failed to place order. Please try again.');
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'An error occurred');
    },
  });

  const handlePlaceOrder = () => {
    if (!validateForm()) {
      setError('Please fill in all required fields correctly.');
      return;
    }

    setError(null);

    const shippingPart =
      shippingMode === 'saved' && selectedShippingId
        ? { shippingAddressId: selectedShippingId }
        : { shippingAddress: buildAddress(shippingAddress), saveShippingAddress };

    const billingPart = billingSameAsShipping
      ? {}
      : billingMode === 'saved' && selectedBillingId
        ? { billingAddressId: selectedBillingId }
        : { billingAddress: buildAddress(billingAddress), saveBillingAddress };

    checkoutMutation.mutate({
      body: {
        ...shippingPart,
        billingSameAsShipping,
        ...billingPart,
      },
    });
  };

  const updateShippingField = (field: keyof AddressFormData, value: string) => {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));
    if (billingSameAsShipping) {
      setBillingAddress((prev) => ({ ...prev, [field]: value }));
    }
    if (fieldErrors[`shipping.${field}`]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[`shipping.${field}`];
        return next;
      });
    }
  };

  const updateBillingField = (field: keyof AddressFormData, value: string) => {
    setBillingAddress((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[`billing.${field}`]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[`billing.${field}`];
        return next;
      });
    }
  };

  const handleBillingSameAsShippingChange = (checked: boolean) => {
    setBillingSameAsShipping(checked);
    if (checked) {
      setBillingAddress(shippingAddress);
      setFieldErrors((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.startsWith('billing.') || key === 'billingPicker') {
            delete next[key];
          }
        }
        return next;
      });
    }
  };

  if (cartPending) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error && !cart) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      </Container>
    );
  }

  if (!cart) {
    return null;
  }

  const addressSummary = (addr: {
    fullName: string;
    addressLine1: string;
    city: string;
    countryCode: string;
    isDefault: boolean;
  }) => `${addr.fullName}, ${addr.addressLine1}, ${addr.city}, ${addr.countryCode}`;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Checkout
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        <Box sx={{ flex: 1 }}>
          {/* Shipping Address */}
          <Paper sx={{ p: 3, mb: 3, borderTop: '3px solid #4F46E5' }}>
            <Typography variant="h6" gutterBottom>
              Shipping Address
            </Typography>

            {savedAddresses.length > 0 && (
              <RadioGroup
                value={shippingMode === 'saved' ? (selectedShippingId ?? '') : '__new__'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__new__') {
                    setShippingMode('new');
                  } else {
                    setShippingMode('saved');
                    setSelectedShippingId(val);
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.shippingPicker;
                      return next;
                    });
                  }
                }}
                sx={{ mb: 2 }}
              >
                {savedAddresses.map((addr) => (
                  <FormControlLabel
                    key={addr.id}
                    value={addr.id}
                    control={<Radio data-testid={`shipping-radio-${addr.id}`} />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{addressSummary(addr)}</span>
                        {addr.isDefault && <Chip label="Default" size="small" color="primary" />}
                      </Box>
                    }
                  />
                ))}
                <FormControlLabel
                  value="__new__"
                  control={<Radio />}
                  label="Enter a new address"
                  data-testid="shipping-new-radio"
                />
              </RadioGroup>
            )}

            {fieldErrors.shippingPicker && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {fieldErrors.shippingPicker}
              </Alert>
            )}

            {shippingMode === 'new' && (
              <>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Full Name"
                    value={shippingAddress.fullName}
                    onChange={(e) => updateShippingField('fullName', e.target.value)}
                    error={
                      !!fieldErrors['shipping.fullName'] ||
                      !!fieldErrors['shippingAddress.fullName']
                    }
                    helperText={
                      fieldErrors['shipping.fullName'] || fieldErrors['shippingAddress.fullName']
                    }
                    required
                    fullWidth
                  />
                  <TextField
                    label="Address Line 1"
                    value={shippingAddress.addressLine1}
                    onChange={(e) => updateShippingField('addressLine1', e.target.value)}
                    error={
                      !!fieldErrors['shipping.addressLine1'] ||
                      !!fieldErrors['shippingAddress.addressLine1']
                    }
                    helperText={
                      fieldErrors['shipping.addressLine1'] ||
                      fieldErrors['shippingAddress.addressLine1']
                    }
                    required
                    fullWidth
                  />
                  <TextField
                    label="Address Line 2"
                    value={shippingAddress.addressLine2}
                    onChange={(e) => updateShippingField('addressLine2', e.target.value)}
                    fullWidth
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="City"
                      value={shippingAddress.city}
                      onChange={(e) => updateShippingField('city', e.target.value)}
                      error={
                        !!fieldErrors['shipping.city'] || !!fieldErrors['shippingAddress.city']
                      }
                      helperText={
                        fieldErrors['shipping.city'] || fieldErrors['shippingAddress.city']
                      }
                      required
                      fullWidth
                    />
                    <TextField
                      label="State/Province"
                      value={shippingAddress.state}
                      onChange={(e) => updateShippingField('state', e.target.value)}
                      fullWidth
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Postal Code"
                      value={shippingAddress.postalCode}
                      onChange={(e) => updateShippingField('postalCode', e.target.value)}
                      error={
                        !!fieldErrors['shipping.postalCode'] ||
                        !!fieldErrors['shippingAddress.postalCode']
                      }
                      helperText={
                        fieldErrors['shipping.postalCode'] ||
                        fieldErrors['shippingAddress.postalCode']
                      }
                      required
                      fullWidth
                    />
                    <TextField
                      label="Country Code"
                      value={shippingAddress.countryCode}
                      onChange={(e) => updateShippingField('countryCode', e.target.value)}
                      error={
                        !!fieldErrors['shipping.countryCode'] ||
                        !!fieldErrors['shippingAddress.countryCode']
                      }
                      helperText={
                        fieldErrors['shipping.countryCode'] ||
                        fieldErrors['shippingAddress.countryCode']
                      }
                      placeholder="US"
                      required
                      fullWidth
                    />
                  </Box>
                  <TextField
                    label="Phone"
                    value={shippingAddress.phone}
                    onChange={(e) => updateShippingField('phone', e.target.value)}
                    fullWidth
                  />
                </Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={saveShippingAddress}
                      onChange={(e) => setSaveShippingAddress(e.target.checked)}
                      data-testid="save-shipping-checkbox"
                    />
                  }
                  label="Save this address"
                  sx={{ mt: 1 }}
                />
              </>
            )}
          </Paper>

          {/* Billing Address */}
          <Paper sx={{ p: 3, borderTop: '3px solid #818CF8' }}>
            <Typography variant="h6" gutterBottom>
              Billing Address
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={billingSameAsShipping}
                  onChange={(e) => handleBillingSameAsShippingChange(e.target.checked)}
                />
              }
              label="Same as shipping address"
              sx={{ mb: 2 }}
            />

            {!billingSameAsShipping && (
              <>
                {savedAddresses.length > 0 && (
                  <RadioGroup
                    value={billingMode === 'saved' ? (selectedBillingId ?? '') : '__new__'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__new__') {
                        setBillingMode('new');
                      } else {
                        setBillingMode('saved');
                        setSelectedBillingId(val);
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.billingPicker;
                          return next;
                        });
                      }
                    }}
                    sx={{ mb: 2 }}
                  >
                    {savedAddresses.map((addr) => (
                      <FormControlLabel
                        key={addr.id}
                        value={addr.id}
                        control={<Radio />}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{addressSummary(addr)}</span>
                            {addr.isDefault && (
                              <Chip label="Default" size="small" color="primary" />
                            )}
                          </Box>
                        }
                      />
                    ))}
                    <FormControlLabel
                      value="__new__"
                      control={<Radio />}
                      label="Enter a new address"
                    />
                  </RadioGroup>
                )}

                {fieldErrors.billingPicker && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {fieldErrors.billingPicker}
                  </Alert>
                )}

                {billingMode === 'new' && (
                  <>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="Full Name"
                        value={billingAddress.fullName}
                        onChange={(e) => updateBillingField('fullName', e.target.value)}
                        error={!!fieldErrors['billing.fullName']}
                        helperText={fieldErrors['billing.fullName']}
                        required
                        fullWidth
                      />
                      <TextField
                        label="Address Line 1"
                        value={billingAddress.addressLine1}
                        onChange={(e) => updateBillingField('addressLine1', e.target.value)}
                        error={!!fieldErrors['billing.addressLine1']}
                        helperText={fieldErrors['billing.addressLine1']}
                        required
                        fullWidth
                      />
                      <TextField
                        label="Address Line 2"
                        value={billingAddress.addressLine2}
                        onChange={(e) => updateBillingField('addressLine2', e.target.value)}
                        fullWidth
                      />
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                          label="City"
                          value={billingAddress.city}
                          onChange={(e) => updateBillingField('city', e.target.value)}
                          error={!!fieldErrors['billing.city']}
                          helperText={fieldErrors['billing.city']}
                          required
                          fullWidth
                        />
                        <TextField
                          label="State/Province"
                          value={billingAddress.state}
                          onChange={(e) => updateBillingField('state', e.target.value)}
                          fullWidth
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                          label="Postal Code"
                          value={billingAddress.postalCode}
                          onChange={(e) => updateBillingField('postalCode', e.target.value)}
                          error={!!fieldErrors['billing.postalCode']}
                          helperText={fieldErrors['billing.postalCode']}
                          required
                          fullWidth
                        />
                        <TextField
                          label="Country Code"
                          value={billingAddress.countryCode}
                          onChange={(e) => updateBillingField('countryCode', e.target.value)}
                          error={!!fieldErrors['billing.countryCode']}
                          helperText={fieldErrors['billing.countryCode']}
                          placeholder="US"
                          required
                          fullWidth
                        />
                      </Box>
                      <TextField
                        label="Phone"
                        value={billingAddress.phone}
                        onChange={(e) => updateBillingField('phone', e.target.value)}
                        fullWidth
                      />
                    </Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={saveBillingAddress}
                          onChange={(e) => setSaveBillingAddress(e.target.checked)}
                        />
                      }
                      label="Save this address"
                      sx={{ mt: 1 }}
                    />
                  </>
                )}
              </>
            )}

            {billingSameAsShipping && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Full Name"
                  value={shippingAddress.fullName}
                  required
                  fullWidth
                  disabled
                />
                <TextField
                  label="Address Line 1"
                  value={shippingAddress.addressLine1}
                  required
                  fullWidth
                  disabled
                />
                <TextField
                  label="Address Line 2"
                  value={shippingAddress.addressLine2}
                  fullWidth
                  disabled
                />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="City"
                    value={shippingAddress.city}
                    required
                    fullWidth
                    disabled
                  />
                  <TextField
                    label="State/Province"
                    value={shippingAddress.state}
                    fullWidth
                    disabled
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Postal Code"
                    value={shippingAddress.postalCode}
                    required
                    fullWidth
                    disabled
                  />
                  <TextField
                    label="Country Code"
                    value={shippingAddress.countryCode}
                    required
                    fullWidth
                    disabled
                  />
                </Box>
                <TextField label="Phone" value={shippingAddress.phone} fullWidth disabled />
              </Box>
            )}
          </Paper>
        </Box>

        <Box sx={{ minWidth: { xs: '100%', md: 350 } }}>
          <Paper
            sx={{
              p: 3,
              position: 'sticky',
              top: 16,
              borderTop: '3px solid',
              borderImage: 'linear-gradient(135deg, #4F46E5, #7C3AED) 1',
            }}
          >
            <Typography variant="h6" gutterBottom>
              Order Summary
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 2, maxHeight: 300, overflowY: 'auto' }}>
              {cart.items.map((item) => (
                <Card key={item.id} variant="outlined" sx={{ mb: 1 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Box
                        component="img"
                        src={item.productImageUrl ?? noPhoto}
                        alt={item.productName}
                        sx={{
                          width: 50,
                          height: 50,
                          objectFit: item.productImageUrl ? 'cover' : 'none',
                          bgcolor: '#F5F5F4',
                          borderRadius: 1,
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          {item.productName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Qty: {item.quantity} × {formatPrice(item.unitPrice, item.currency)}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatPrice(item.lineTotal, item.currency)}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body1">Subtotal:</Typography>
              <Typography variant="body1">
                {cart.currency ? formatPrice(cart.subtotal, cart.currency) : cart.subtotal}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Tax:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {cart.currency ? formatPrice('0.00', cart.currency) : '$0.00'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Shipping:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {cart.currency ? formatPrice('0.00', cart.currency) : '$0.00'}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6">Total:</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {cart.currency ? formatPrice(cart.subtotal, cart.currency) : cart.subtotal}
              </Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={() => handlePlaceOrder()}
              disabled={checkoutMutation.isPending}
              sx={{
                background: 'linear-gradient(135deg, #4F46E5, #4338CA)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4338CA, #3730A3)',
                },
              }}
            >
              {checkoutMutation.isPending ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Place Order'
              )}
            </Button>
          </Paper>
        </Box>
      </Box>
    </Container>
  );
}
