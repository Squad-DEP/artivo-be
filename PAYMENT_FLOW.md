# Payment & Escrow Flow

## Current Implementation

The backend already implements the correct PSP-native escrow model. Squad holds the money, we just track state.

---

## Flow for Online Payment (Squad Checkout)

### 1. **Customer Accepts Proposal / Hires Worker**
```
POST /customer/hire
{
  "proposal_id": "uuid",  // or job_request_id + worker_id + amount
  "payment_method": "online"
}

Response:
{
  "job": { "id": "job-uuid", "status": "pending_payment", ... },
  "escrow": { "status": "pending", ... },
  "requires_payment": true  // ← Frontend should open Squad checkout
}
```

**What happens:**
- Job created with status `pending_payment`
- Escrow entry created with status `pending`
- Money NOT yet in Squad

---

### 2. **Frontend Opens Squad Checkout Modal**

Frontend uses Squad JS SDK:
```javascript
const squad = new squad({
  onClose: () => console.log("Widget closed"),
  onLoad: () => console.log("Widget loaded"),
  onSuccess: (response) => {
    // response.transaction_ref is the Squad transaction reference
    // Call backend to verify and log payment
    verifyPayment(jobId, response.transaction_ref);
  },
  key: "YOUR_SQUAD_PUBLIC_KEY",
  email: customerEmail,
  amount: jobAmount * 100, // Convert NGN to kobo
  currency_code: "NGN",
  transaction_ref: generateUniqueRef(),
});

squad.setup();
squad.open();
```

**What happens:**
- Customer pays via Squad checkout
- Money lands in **Squad's bank account** (not any user's account)
- Squad fires webhook to your backend
- Squad calls `onSuccess` callback with `transaction_ref`

---

### 3. **Backend Receives Squad Webhook (Automatic)**

```
POST /squad/webhook
{
  "event": "charge_successful",
  "transaction_ref": "SQ_ABC123",
  "amount": 1000000,  // kobo
  "customer_identifier": "CUST_123",
  ...
}
```

**What happens:**
- Webhook handler verifies signature
- Credits virtual account balance (tracking ledger)
- Logs payment in `payment_logs` table
- Funds escrow: `escrow.status = 'funded'`
- Updates job: `job.status = 'paid'`

**Money location:** Still in Squad's bank account, tracked in your DB

---

### 4. **Frontend Calls Verify Payment (After onSuccess)**

```
POST /customer/verify-payment
{
  "job_id": "job-uuid",
  "transaction_reference": "SQ_ABC123"
}

Response:
{
  "payment_log": { ... },
  "msg": "Payment verified and logged successfully"
}
```

**What happens:**
- Backend calls Squad API: `GET /transaction/verify/:ref`
- Confirms transaction status is `success`
- Confirms amount matches job amount
- Idempotently logs payment (if webhook already did it, no duplicate)
- Funds escrow if not already funded

**Money location:** Still in Squad's bank account

---

### 5. **Job Completion (Both Parties Confirm)**

Worker confirms:
```
POST /worker/complete-job/:job_id
```

Customer confirms:
```
POST /customer/complete-job/:job_id
```

**What happens:**
- First confirmation: Records confirmation, waits for other party
- Second confirmation: 
  - Marks escrow as `released`
  - Calls Squad Transfer API to send money to worker's bank
  - Updates job status to `completed`

**Money location:** Transferred from Squad's account to worker's personal bank account

---

## Flow for Offline Payment

### 1. **Customer Hires Worker (Offline)**
```
POST /customer/hire
{
  "proposal_id": "uuid",
  "payment_method": "offline"
}

Response:
{
  "job": { "id": "job-uuid", "status": "in_progress", ... },
  "escrow": { "status": "funded", ... },
  "requires_payment": false  // ← No Squad checkout needed
}
```

**What happens:**
- Job created with status `in_progress` (no payment needed)
- Escrow marked as `funded` immediately (trust-based)
- No Squad payment involved

---

## Key Points for Frontend Integration

### After Hire Endpoint:
```javascript
const response = await fetch('/customer/hire', { ... });
const { job, escrow, requires_payment } = await response.json();

if (requires_payment) {
  // Open Squad checkout modal
  openSquadCheckout(job.id, job.amount);
} else {
  // Offline payment - job starts immediately
  navigateToJobDetails(job.id);
}
```

### Squad Checkout Success:
```javascript
onSuccess: async (response) => {
  // Verify payment with backend
  await fetch('/customer/verify-payment', {
    method: 'POST',
    body: JSON.stringify({
      job_id: currentJobId,
      transaction_reference: response.transaction_ref
    })
  });
  
  // Show success message and navigate
  showSuccess("Payment confirmed! Job is now active.");
  navigateToJobDetails(currentJobId);
}
```

---

## Money Flow Summary

1. **Customer pays** → Money goes to **Squad's bank account**
2. **Your DB tracks** → Who paid, how much, for which job
3. **Squad holds** → Money sits in their licensed custody (escrow)
4. **Job completes** → You call Squad Transfer API
5. **Squad sends** → Money goes from their account to worker's bank
6. **You never touch** → The actual money, just track state

---

## Virtual Accounts (Deposits)

Virtual accounts are for **receiving deposits**, not for escrow:

```
Customer deposits to NUBAN 8277238916
  ↓
Money lands in Squad's bank account
  ↓
Squad fires webhook
  ↓
Backend credits virtual_accounts.balance (ledger)
  ↓
Customer can use balance for future jobs
```

**Current issue:** Balance is pooled, not job-specific. For clean escrow, lock funds to specific jobs at deposit time. But for demo, current model works fine.

---

## Endpoints Summary

| Endpoint | Purpose | When to Call |
|----------|---------|--------------|
| `POST /customer/hire` | Create job & escrow | When accepting proposal |
| `POST /customer/verify-payment` | Verify Squad payment | After Squad checkout success |
| `POST /customer/complete-job/:id` | Confirm job done | When customer confirms completion |
| `POST /worker/complete-job/:id` | Confirm job done | When worker confirms completion |
| `POST /squad/webhook` | Receive Squad events | Automatic (Squad calls it) |

---

## What's Already Correct

✅ Squad holds the money (PSP-native escrow)  
✅ Your DB is just a ledger (tracks state, not money)  
✅ Escrow status tracks payment lifecycle  
✅ Transfer API sends money directly to worker's bank  
✅ Webhook handles automatic payment confirmation  
✅ Verify endpoint provides manual confirmation fallback  

## What Could Be Improved (Post-Demo)

- Lock deposits to specific jobs (not pooled balance)
- Add dispute resolution flow
- Add refund flow for cancelled jobs
- Add partial payment support
- Add payment retry logic
