import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Container } from '@/components/ui/container';
import { FormField } from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
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
      <Container>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner className="size-10" />
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Address Book</h1>
        {formMode.type === 'none' && <Button onClick={handleOpenAdd}>Add Address</Button>}
      </div>

      {mutationError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{mutationError}</AlertDescription>
          <AlertAction>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setMutationError(null)}
              aria-label="Dismiss error"
            >
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}

      {addresses.length === 0 && formMode.type === 'none' && (
        <p className="text-muted-foreground">
          No saved addresses yet. Add one to speed up checkout.
        </p>
      )}

      <div className={`flex flex-wrap gap-4 ${formMode.type !== 'none' ? 'mb-6' : ''}`}>
        {addresses.map((addr) => (
          <div
            key={addr.id}
            data-testid="address-card"
            className="max-w-80 min-w-65 flex-1 rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <p className="font-semibold">{addr.fullName}</p>
              {addr.isDefault && <Badge data-testid="default-chip">Default</Badge>}
            </div>
            <p className="text-sm">{addr.addressLine1}</p>
            {addr.addressLine2 && <p className="text-sm">{addr.addressLine2}</p>}
            <p className="text-sm">
              {addr.city}
              {addr.state ? `, ${addr.state}` : ''} {addr.postalCode}
            </p>
            <p className="text-sm">{addr.countryCode}</p>
            {addr.phone && <p className="text-sm">{addr.phone}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {!addr.isDefault && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetDefault(addr.id)}
                  disabled={isMutating}
                >
                  Set as Default
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEdit(addr.id)}
                disabled={isMutating}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => handleDelete(addr.id)}
                disabled={isMutating}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {formMode.type !== 'none' && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">
            {formMode.type === 'add' ? 'Add Address' : 'Edit Address'}
          </h2>
          <div className="flex flex-col gap-4">
            <FormField
              id="address-full-name"
              label="Full Name"
              value={formData.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              error={fieldErrors.fullName}
              required
            />
            <FormField
              id="address-address-line-1"
              label="Address Line 1"
              value={formData.addressLine1}
              onChange={(e) => updateField('addressLine1', e.target.value)}
              error={fieldErrors.addressLine1}
              required
            />
            <FormField
              id="address-address-line-2"
              label="Address Line 2"
              value={formData.addressLine2}
              onChange={(e) => updateField('addressLine2', e.target.value)}
            />
            <div className="flex gap-4">
              <FormField
                id="address-city"
                label="City"
                value={formData.city}
                onChange={(e) => updateField('city', e.target.value)}
                error={fieldErrors.city}
                required
              />
              <FormField
                id="address-state"
                label="State/Province"
                value={formData.state}
                onChange={(e) => updateField('state', e.target.value)}
              />
            </div>
            <div className="flex gap-4">
              <FormField
                id="address-postal-code"
                label="Postal Code"
                value={formData.postalCode}
                onChange={(e) => updateField('postalCode', e.target.value)}
                error={fieldErrors.postalCode}
                required
              />
              <FormField
                id="address-country-code"
                label="Country Code"
                value={formData.countryCode}
                onChange={(e) => updateField('countryCode', e.target.value)}
                error={fieldErrors.countryCode}
                placeholder="US"
                required
              />
            </div>
            <FormField
              id="address-phone"
              label="Phone"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
            <Label className="w-fit">
              <Checkbox
                id="address-set-default"
                checked={formData.isDefault}
                onCheckedChange={(checked) => updateField('isDefault', checked === true)}
              />
              Set as default
            </Label>
            <div className="flex gap-4">
              <Button onClick={handleSubmit} disabled={isMutating}>
                {isMutating ? <Spinner /> : 'Save'}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={isMutating}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
