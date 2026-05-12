# Squad Payment Integration

## Backend APIs (For Frontend)
Note: 
### Virtual Account Creation
- Automatically created after email verification
- Uses Squad API to create account
- Saves to database
- Bank: GTCO (058)

### Webhook Handler
- Endpoint: `POST /api/v1/squad/webhook`
- Validates HMAC SHA512 signature
- Logs payments automatically
- Updates job status

### Error Handling
- Retry logic for transient failures
- Typed error classes
- Structured logging
- Sensitive data redaction

---

### 1. Get Virtual Account
```bash
GET /api/v1/user/virtual-account
Authorization: Bearer <token>

Response:
{
  "virtual_account": {
    "virtual_account_number": "7834927713",
    "virtual_account_name": "John Doe",
    "bank_name": "GTCO",
    "bank_code": "058"
  }
}
```

### 2. Log Payment
```bash
POST /api/v1/customer/payment
Authorization: Bearer <customer_token>

{
  "job_id": "uuid",
  "squad_transaction_id": "SQ_12345",
  "amount": 15000,
  "status": "success"
}
```

---

## Frontend Integration

### Display Virtual Account
```typescript
const response = await fetch('/api/v1/user/virtual-account', {
  headers: { 'Authorization': `Bearer ${worker_token}` }
});

const { virtual_account } = await response.json();
```

### Squad Payment Modal
```typescript
import { SquadPay } from '@squadco/squad-modal';

SquadPay({
  key: 'sandbox_pk_...',
  email: customer.email,
  amount: 15000 * 100,
  currency: 'NGN',
  onSuccess: (response) => {
    logPaymentToBackend(response.transaction_ref);
  }
});
```

### Log Payment After Success
```typescript
await fetch('/api/v1/customer/payment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${customer_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    job_id: jobId,
    squad_transaction_id: transactionRef,
    amount: 15000,
    status: 'success'
  })
});
```

---

## Payment Flow

1. Customer hires worker → `POST /api/v1/customer/hire`
2. Get worker's virtual account → `GET /api/v1/user/virtual-account`
3. Show payment modal or bank transfer details
4. Customer pays via Squad modal or bank transfer
5. Log payment → `POST /api/v1/customer/payment`
6. Backend updates job status to 'paid'

---

## Environment Variables

**Backend:**
```env
SQUAD_BASE_URL=https://sandbox-api-d.squadco.com
SQUAD_SECRET_KEY=sandbox_sk_...
```

**Frontend:**
```env
NEXT_PUBLIC_SQUAD_PUBLIC_KEY=sandbox_pk_...
```

## Testing

### Test Virtual Account Creation
```bash
# 1. Sign up
POST /api/v1/auth/sign-up
{ "email": "test@example.com", "password": "Password@1234", "firstName": "Test", "role": "worker", "tos": true }

# 2. Verify email
POST /api/v1/auth/verify-email-manual
{ "email": "test@example.com" }

# 3. Get virtual account
GET /api/v1/user/virtual-account
Authorization: Bearer <token>
```

---
**Sandbox:**
```env
SQUAD_BASE_URL=https://sandbox-api-d.squadco.com
SQUAD_SECRET_KEY=sandbox_sk_...
```

**Production:**
```env
SQUAD_BASE_URL=https://api-d.squadco.com
SQUAD_SECRET_KEY=live_sk_...
```
