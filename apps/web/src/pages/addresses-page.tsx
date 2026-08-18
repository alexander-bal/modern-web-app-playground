import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
  isDefault: boolean;
}

const emptyForm: AddressFormData = {
  fullName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  countryCode: 'US',
  phone: '',
  isDefault: false,
};

type FormMode = { type: 'add' } | { type: 'edit'; id: string } | { type: 'none' };

export function AddressesPage() {
  const queryClient = useQueryClient();
  const [formMode, setFormMode] = useState<FormMode>({ type: 'none' });
  const [formData, setFormData] = useState<AddressFormData>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { data, isPending } = tsr.addresses.list.useQuery({ queryKey: ['addresses'] });
  const addresses = data?.status === 200 ? data.body.addresses : [];

  const createMutation = tsr.addresses.create.useMutation({
    onSuccess: (response) => {
      if (response.status === 201) {
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
        setFormMode({ type: 'none' });
        setFormData(emptyForm);
        setMutationError(null);
      } else {
        setMutationError('Failed to create address.');
      }
    },
    onError: () => setMutationError('Failed to create address.'),
  });

  const updateMutation = tsr.addresses.update.useMutation({
    onSuccess: (response) => {
      if (response.status === 200) {
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
        setFormMode({ type: 'none' });
        setFormData(emptyForm);
        setMutationError(null);
      } else {
        setMutationError('Failed to update address.');
      }
    },
    onError: () => setMutationError('Failed to update address.'),
  });

  const deleteMutation = tsr.addresses.delete.useMutation({
    onSuccess: (response) => {
      if (response.status === 204) {
        queryClient.invalidateQueries({ queryKey: ['addresses'] });
      } else {
        setMutationError('Failed to delete address.');
      }
    },
    onError: () => setMutationError('Failed to delete address.'),
  });

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.fullName.trim()) errors.fullName = 'Full name is required';
    if (!formData.addressLine1.trim()) errors.addressLine1 = 'Address line 1 is required';
    if (!formData.city.trim()) errors.city = 'City is required';
    if (!formData.postalCode.trim()) errors.postalCode = 'Postal code is required';
    if (!formData.countryCode.trim() || formData.countryCode.length !== 2)
      errors.countryCode = 'Valid 2-letter country code is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    const body = {
      fullName: formData.fullName,
      addressLine1: formData.addressLine1,
      addressLine2: formData.addressLine2 || undefined,
      city: formData.city,
      state: formData.state || undefined,
      postalCode: formData.postalCode,
      countryCode: formData.countryCode.toUpperCase(),
      phone: formData.phone || undefined,
      isDefault: formData.isDefault,
    };
    if (formMode.type === 'add') {
      createMutation.mutate({ body });
    } else if (formMode.type === 'edit') {
      updateMutation.mutate({ params: { id: formMode.id }, body });
    }
  };

  const handleEdit = (id: string) => {
    const addr = addresses.find((a) => a.id === id);
    if (!addr) return;
    setFormData({
      fullName: addr.fullName,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 ?? '',
      city: addr.city,
      state: addr.state ?? '',
      postalCode: addr.postalCode,
      countryCode: addr.countryCode,
      phone: addr.phone ?? '',
      isDefault: addr.isDefault,
    });
    setFormMode({ type: 'edit', id });
    setFieldErrors({});
    setMutationError(null);
  };

  const handleSetDefault = (id: string) => {
    updateMutation.mutate({ params: { id }, body: { isDefault: true } });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ params: { id } });
  };

  const handleCancel = () => {
    setFormMode({ type: 'none' });
    setFormData(emptyForm);
    setFieldErrors({});
    setMutationError(null);
  };

  const handleOpenAdd = () => {
    setFormData(emptyForm);
    setFormMode({ type: 'add' });
    setFieldErrors({});
    setMutationError(null);
  };

  const updateField = (field: keyof AddressFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (typeof field === 'string' && fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  if (isPending) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Address Book
        </Typography>
        {formMode.type === 'none' && (
          <Button variant="contained" onClick={handleOpenAdd}>
            Add Address
          </Button>
        )}
      </Box>

      {mutationError && (
        <Alert severity="error" onClose={() => setMutationError(null)} sx={{ mb: 2 }}>
          {mutationError}
        </Alert>
      )}

      {addresses.length === 0 && formMode.type === 'none' && (
        <Typography color="text.secondary">
          No saved addresses yet. Add one to speed up checkout.
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: formMode.type !== 'none' ? 3 : 0 }}>
        {addresses.map((addr) => (
          <Paper
            key={addr.id}
            sx={{
              p: 2,
              minWidth: 260,
              maxWidth: 320,
              flex: '1 1 260px',
              borderTop: '3px solid #4F46E5',
            }}
            data-testid="address-card"
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {addr.fullName}
              </Typography>
              {addr.isDefault && (
                <Chip label="Default" size="small" color="primary" data-testid="default-chip" />
              )}
            </Box>
            <Typography variant="body2">{addr.addressLine1}</Typography>
            {addr.addressLine2 && <Typography variant="body2">{addr.addressLine2}</Typography>}
            <Typography variant="body2">
              {addr.city}
              {addr.state ? `, ${addr.state}` : ''} {addr.postalCode}
            </Typography>
            <Typography variant="body2">{addr.countryCode}</Typography>
            {addr.phone && <Typography variant="body2">{addr.phone}</Typography>}
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
              {!addr.isDefault && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleSetDefault(addr.id)}
                  disabled={isMutating}
                >
                  Set as Default
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleEdit(addr.id)}
                disabled={isMutating}
              >
                Edit
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => handleDelete(addr.id)}
                disabled={isMutating}
              >
                Delete
              </Button>
            </Box>
          </Paper>
        ))}
      </Box>

      {formMode.type !== 'none' && (
        <Paper sx={{ p: 3, borderTop: '3px solid #4F46E5' }}>
          <Typography variant="h6" gutterBottom>
            {formMode.type === 'add' ? 'Add Address' : 'Edit Address'}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Full Name"
              value={formData.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              error={!!fieldErrors.fullName}
              helperText={fieldErrors.fullName}
              required
              fullWidth
            />
            <TextField
              label="Address Line 1"
              value={formData.addressLine1}
              onChange={(e) => updateField('addressLine1', e.target.value)}
              error={!!fieldErrors.addressLine1}
              helperText={fieldErrors.addressLine1}
              required
              fullWidth
            />
            <TextField
              label="Address Line 2"
              value={formData.addressLine2}
              onChange={(e) => updateField('addressLine2', e.target.value)}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="City"
                value={formData.city}
                onChange={(e) => updateField('city', e.target.value)}
                error={!!fieldErrors.city}
                helperText={fieldErrors.city}
                required
                fullWidth
              />
              <TextField
                label="State/Province"
                value={formData.state}
                onChange={(e) => updateField('state', e.target.value)}
                fullWidth
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Postal Code"
                value={formData.postalCode}
                onChange={(e) => updateField('postalCode', e.target.value)}
                error={!!fieldErrors.postalCode}
                helperText={fieldErrors.postalCode}
                required
                fullWidth
              />
              <TextField
                label="Country Code"
                value={formData.countryCode}
                onChange={(e) => updateField('countryCode', e.target.value)}
                error={!!fieldErrors.countryCode}
                helperText={fieldErrors.countryCode}
                placeholder="US"
                required
                fullWidth
              />
            </Box>
            <TextField
              label="Phone"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isDefault}
                  onChange={(e) => updateField('isDefault', e.target.checked)}
                />
              }
              label="Set as default"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="contained" onClick={handleSubmit} disabled={isMutating}>
                {isMutating ? <CircularProgress size={20} color="inherit" /> : 'Save'}
              </Button>
              <Button variant="outlined" onClick={handleCancel} disabled={isMutating}>
                Cancel
              </Button>
            </Box>
          </Box>
        </Paper>
      )}
    </Container>
  );
}
