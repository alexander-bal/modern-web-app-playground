import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Container } from '@/components/ui/container';
import { FormField } from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
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

interface AddressFieldSpec {
  name: keyof AddressFormData;
  label: string;
  slug: string;
  required?: boolean;
  placeholder?: string;
}

/** Address inputs grouped into rows; two-field rows sit side by side. */
const ADDRESS_ROWS: AddressFieldSpec[][] = [
  [{ name: 'fullName', label: 'Full Name', slug: 'full-name', required: true }],
  [{ name: 'addressLine1', label: 'Address Line 1', slug: 'address-line-1', required: true }],
  [{ name: 'addressLine2', label: 'Address Line 2', slug: 'address-line-2' }],
  [
    { name: 'city', label: 'City', slug: 'city', required: true },
    { name: 'state', label: 'State/Province', slug: 'state' },
  ],
  [
    { name: 'postalCode', label: 'Postal Code', slug: 'postal-code', required: true },
    {
      name: 'countryCode',
      label: 'Country Code',
      slug: 'country-code',
      required: true,
      placeholder: 'US',
    },
  ],
  [{ name: 'phone', label: 'Phone', slug: 'phone' }],
];

interface AddressFieldsProps {
  idPrefix: string;
  address: AddressFormData;
  /** Key prefix under which validation messages are stored, e.g. `shipping`. */
  errorPrefix?: string;
  fieldErrors?: Record<string, string>;
  onChange?: (field: keyof AddressFormData, value: string) => void;
  disabled?: boolean;
}

function AddressFields({
  idPrefix,
  address,
  errorPrefix,
  fieldErrors,
  onChange,
  disabled,
}: AddressFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      {ADDRESS_ROWS.map((row) => {
        const inputs = row.map((f) => (
          <FormField
            key={f.name}
            id={`${idPrefix}-${f.slug}`}
            label={f.label}
            value={address[f.name]}
            onChange={(e) => onChange?.(f.name, e.target.value)}
            error={errorPrefix ? fieldErrors?.[`${errorPrefix}.${f.name}`] : undefined}
            placeholder={f.placeholder}
            required={f.required}
            disabled={disabled}
          />
        ));

        return row.length > 1 ? (
          <div key={row[0].name} className="flex gap-4">
            {inputs}
          </div>
        ) : (
          inputs
        );
      })}
    </div>
  );
}

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
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      navigate(`/orders/${response.body.orderNumber}/confirmation`);
    },
    onError: (err) => {
      if (err instanceof Error) {
        setError(err.message);
      } else if (err.status === 400) {
        setError(err.body.error || 'Invalid request. Please check your input.');
      } else if (err.status === 422) {
        setError(err.body.error);
      } else if (err.status === 404) {
        setError('Cart not found. Please add items to your cart.');
      } else if (err.status === 401) {
        setError('Please log in to complete your order.');
      } else {
        setError('Failed to place order. Please try again.');
      }
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
      <Container>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner className="size-10" />
        </div>
      </Container>
    );
  }

  if (error && !cart) {
    return (
      <Container>
        <div className="mt-8">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
            <AlertAction>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              >
                <X />
              </Button>
            </AlertAction>
          </Alert>
        </div>
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
    <Container className="py-8">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Checkout</h1>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-6 rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">Shipping Address</h2>

            {savedAddresses.length > 0 && (
              <RadioGroup
                className="mb-4"
                value={shippingMode === 'saved' ? (selectedShippingId ?? '') : '__new__'}
                onValueChange={(value) => {
                  const val = value as string;
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
              >
                {savedAddresses.map((addr) => (
                  <Label key={addr.id} className="w-fit font-normal">
                    <RadioGroupItem value={addr.id} data-testid={`shipping-radio-${addr.id}`} />
                    <span>{addressSummary(addr)}</span>
                    {addr.isDefault && <Badge>Default</Badge>}
                  </Label>
                ))}
                <Label className="w-fit font-normal">
                  <RadioGroupItem value="__new__" data-testid="shipping-new-radio" />
                  Enter a new address
                </Label>
              </RadioGroup>
            )}

            {fieldErrors.shippingPicker && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{fieldErrors.shippingPicker}</AlertDescription>
              </Alert>
            )}

            {shippingMode === 'new' && (
              <>
                <AddressFields
                  idPrefix="shipping"
                  address={shippingAddress}
                  errorPrefix="shipping"
                  fieldErrors={fieldErrors}
                  onChange={updateShippingField}
                />
                <Label className="mt-4 w-fit font-normal">
                  <Checkbox
                    id="save-shipping-address"
                    checked={saveShippingAddress}
                    onCheckedChange={(checked) => setSaveShippingAddress(checked === true)}
                    data-testid="save-shipping-checkbox"
                  />
                  Save this address
                </Label>
              </>
            )}
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">Billing Address</h2>
            <Label className="mb-4 w-fit font-normal">
              <Checkbox
                id="billing-same-as-shipping"
                checked={billingSameAsShipping}
                onCheckedChange={(checked) => handleBillingSameAsShippingChange(checked === true)}
              />
              Same as shipping address
            </Label>

            {!billingSameAsShipping && (
              <>
                {savedAddresses.length > 0 && (
                  <RadioGroup
                    className="mb-4"
                    value={billingMode === 'saved' ? (selectedBillingId ?? '') : '__new__'}
                    onValueChange={(value) => {
                      const val = value as string;
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
                  >
                    {savedAddresses.map((addr) => (
                      <Label key={addr.id} className="w-fit font-normal">
                        <RadioGroupItem value={addr.id} />
                        <span>{addressSummary(addr)}</span>
                        {addr.isDefault && <Badge>Default</Badge>}
                      </Label>
                    ))}
                    <Label className="w-fit font-normal">
                      <RadioGroupItem value="__new__" />
                      Enter a new address
                    </Label>
                  </RadioGroup>
                )}

                {fieldErrors.billingPicker && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{fieldErrors.billingPicker}</AlertDescription>
                  </Alert>
                )}

                {billingMode === 'new' && (
                  <>
                    <AddressFields
                      idPrefix="billing"
                      address={billingAddress}
                      errorPrefix="billing"
                      fieldErrors={fieldErrors}
                      onChange={updateBillingField}
                    />
                    <Label className="mt-4 w-fit font-normal">
                      <Checkbox
                        id="save-billing-address"
                        checked={saveBillingAddress}
                        onCheckedChange={(checked) => setSaveBillingAddress(checked === true)}
                      />
                      Save this address
                    </Label>
                  </>
                )}
              </>
            )}

            {billingSameAsShipping && (
              <AddressFields idPrefix="billing-mirror" address={shippingAddress} disabled />
            )}
          </div>
        </div>

        <div className="w-full md:w-88 md:shrink-0">
          <div className="sticky top-4 rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">Order Summary</h2>
            <Separator className="my-4" />

            <div className="mb-4 max-h-75 overflow-y-auto">
              {cart.items.map((item) => (
                <div key={item.id} className="mb-2 rounded-lg border p-4">
                  <div className="flex gap-2">
                    <img
                      src={item.productImageUrl ?? noPhoto}
                      alt={item.productName}
                      className={`size-12 shrink-0 rounded bg-muted ${
                        item.productImageUrl ? 'object-cover' : 'object-none'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{item.productName}</p>
                      <span className="text-xs text-muted-foreground">
                        Qty: {item.quantity} × {formatPrice(item.unitPrice, item.currency)}
                      </span>
                      <p className="text-sm font-bold">
                        {formatPrice(item.lineTotal, item.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="mb-2 flex justify-between">
              <p>Subtotal:</p>
              <p>{cart.currency ? formatPrice(cart.subtotal, cart.currency) : cart.subtotal}</p>
            </div>

            <div className="mb-2 flex justify-between">
              <p className="text-sm text-muted-foreground">Tax:</p>
              <p className="text-sm text-muted-foreground">
                {cart.currency ? formatPrice('0.00', cart.currency) : '$0.00'}
              </p>
            </div>

            <div className="mb-2 flex justify-between">
              <p className="text-sm text-muted-foreground">Shipping:</p>
              <p className="text-sm text-muted-foreground">
                {cart.currency ? formatPrice('0.00', cart.currency) : '$0.00'}
              </p>
            </div>

            <Separator className="my-4" />

            <div className="mb-6 flex justify-between">
              <p className="text-lg font-semibold">Total:</p>
              <p className="text-lg font-bold">
                {cart.currency ? formatPrice(cart.subtotal, cart.currency) : cart.subtotal}
              </p>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => handlePlaceOrder()}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? <Spinner className="size-6" /> : 'Place Order'}
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}
