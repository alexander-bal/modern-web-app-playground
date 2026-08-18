import CheckCircle from '@mui/icons-material/CheckCircle';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { Link, useParams } from 'react-router-dom';
import noPhoto from '../assets/no-photo.svg';
import { tsr } from '../lib/api-client';
import { parseAddress } from '../lib/parse-address';

export function OrderConfirmationPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();

  const {
    data,
    isPending,
    error: queryError,
  } = tsr.orders.getByOrderNumber.useQuery({
    queryKey: ['orders', orderNumber],
    queryData: {
      params: { orderNumber: orderNumber ?? '' },
    },
    enabled: !!orderNumber,
  });

  const order = data?.status === 200 ? data.body : null;
  const shippingAddress = parseAddress(order?.shippingAddress);
  const billingAddress = parseAddress(order?.billingAddress);
  const error = !orderNumber
    ? 'Order number is missing'
    : queryError instanceof Error
      ? queryError.message
      : queryError
        ? queryError.status === 404
          ? 'Order not found'
          : 'Failed to fetch order'
        : null;

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isPending) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !order) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error">{error || 'Order not found'}</Alert>
          <Button component={Link} to="/" variant="contained" sx={{ mt: 2 }}>
            Continue Shopping
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Box
          sx={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <CheckCircle sx={{ fontSize: 80, color: 'success.main' }} />
        </Box>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Order Confirmed!
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Thank you for your order. We've received your order and will process it shortly.
        </Typography>
      </Box>

      <Paper
        sx={{
          p: 3,
          mb: 3,
          borderTop: '3px solid',
          borderImage: 'linear-gradient(135deg, #4F46E5, #7C3AED) 1',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">Order {order.orderNumber}</Typography>
            <Typography variant="body2" color="text.secondary">
              Placed on {formatDate(order.orderDate)}
            </Typography>
          </Box>
          <Chip label={order.status} color="success" />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 3 }}>
          {shippingAddress && (
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Shipping Address
              </Typography>
              <Typography variant="body2">{shippingAddress.fullName}</Typography>
              <Typography variant="body2">{shippingAddress.addressLine1}</Typography>
              {shippingAddress.addressLine2 && (
                <Typography variant="body2">{shippingAddress.addressLine2}</Typography>
              )}
              <Typography variant="body2">
                {shippingAddress.city}
                {shippingAddress.state && `, ${shippingAddress.state}`} {shippingAddress.postalCode}
              </Typography>
              <Typography variant="body2">{shippingAddress.countryCode}</Typography>
              {shippingAddress.phone && (
                <Typography variant="body2">{shippingAddress.phone}</Typography>
              )}
            </Box>
          )}

          {billingAddress && (
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Billing Address
              </Typography>
              <Typography variant="body2">{billingAddress.fullName}</Typography>
              <Typography variant="body2">{billingAddress.addressLine1}</Typography>
              {billingAddress.addressLine2 && (
                <Typography variant="body2">{billingAddress.addressLine2}</Typography>
              )}
              <Typography variant="body2">
                {billingAddress.city}
                {billingAddress.state && `, ${billingAddress.state}`} {billingAddress.postalCode}
              </Typography>
              <Typography variant="body2">{billingAddress.countryCode}</Typography>
              {billingAddress.phone && (
                <Typography variant="body2">{billingAddress.phone}</Typography>
              )}
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Order Items
        </Typography>

        {order.items.map((item) => (
          <Card key={item.id} variant="outlined" sx={{ mb: 1 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box
                  component="img"
                  src={item.productImageUrl ?? noPhoto}
                  alt={item.productName}
                  sx={{
                    width: 60,
                    height: 60,
                    objectFit: item.productImageUrl ? 'cover' : 'none',
                    bgcolor: '#F5F5F4',
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1">{item.productName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    SKU: {item.productSku}
                  </Typography>
                  <Typography variant="body2">
                    Quantity: {item.quantity} × {formatPrice(item.unitPrice, item.currency)}
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 'bold', alignSelf: 'center' }}>
                  {formatPrice(item.lineTotal, item.currency)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body1">Subtotal:</Typography>
          <Typography variant="body1">{formatPrice(order.subtotal, order.currency)}</Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Tax:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatPrice(order.taxAmount, order.currency)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Shipping:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatPrice(order.shippingAmount, order.currency)}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6">Total:</Typography>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {formatPrice(order.totalAmount, order.currency)}
          </Typography>
        </Box>

        <Button
          component={Link}
          to="/"
          variant="contained"
          fullWidth
          size="large"
          sx={{
            background: 'linear-gradient(135deg, #4F46E5, #4338CA)',
            '&:hover': {
              background: 'linear-gradient(135deg, #4338CA, #3730A3)',
            },
          }}
        >
          Continue Shopping
        </Button>
      </Paper>
    </Container>
  );
}
