# Marketplace API Reference

Base URL: `http://localhost:8080/api/v1`

All endpoints require authentication via Bearer token (except auth endpoints).
Add header: `Authorization: Bearer <your_token>`

## Authentication

### Sign Up
POST /auth/sign-up

Request:
{
  "email": "user@example.com",
  "password": "Password@1234",
  "firstName": "John",
  "lastName": "Doe",
  "role": "customer",  // or "worker"
  "tos": true
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

### Login
POST /auth/login

Request:
{
  "email": "user@example.com",
  "password": "Password@1234"
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

---

## Customer Endpoints

### Browse Artisans
GET /customer/feed?location=Lagos&job_type_id=uuid&limit=20

Response:
{
  "workers": [
    {
      "id": "uuid",
      "full_name": "John Doe",
      "display_name": "John the Plumber",
      "photo_url": "https://...",
      "bio": "10 years experience",
      "skills": ["plumbing", "pipe fitting"],
      "location": "Lagos",
      "credit_score": 85,
      "completion_rate": 95,
      "total_jobs": 20,
      "average_rating": 4.5,
      "match_score": 0.87,  // Only when job_type_id provided
      "match_explanation": "..."  // AI explanation
    }
  ]
}

### Post Job Request
POST /customer/request-job

Request:
{
  "job_type_id": "uuid",
  "title": "Fix leaking sink",
  "description": "Urgent repair needed in kitchen",
  "location": "Lagos, Ikeja",
  "budget": 15000
}

Response:
{
  "job_request": {
    "id": "uuid",
    "customer_id": "uuid",
    "job_type_id": "uuid",
    "title": "Fix leaking sink",
    "description": "...",
    "location": "Lagos, Ikeja",
    "budget": 15000,
    "status": "open",
    "created_at": "2026-05-12T..."
  }
}

### Hire Artisan
POST /customer/hire

Request:
{
  "job_request_id": "uuid",
  "worker_id": "uuid",
  "amount": 15000
}

Response:
{
  "job": {
    "id": "uuid",
    "job_request_id": "uuid",
    "worker_id": "uuid",
    "customer_id": "uuid",
    "amount": 15000,
    "status": "pending",
    "created_at": "2026-05-12T..."
  }
}

### Log Payment
POST /customer/payment

Request:
{
  "job_id": "uuid",
  "squad_transaction_id": "SQ_12345",
  "amount": 15000,
  "status": "success"
}

Response:
{
  "payment_log": {
    "id": "uuid",
    "job_id": "uuid",
    "squad_transaction_id": "SQ_12345",
    "amount": 15000,
    "status": "success",
    "created_at": "2026-05-12T..."
  }
}

### Complete Job
POST /customer/complete-job/:job_id

Response:
{
  "success": true,
  "msg": "Job marked as completed"
}

### Rate Artisan
POST /customer/rate

Request:
{
  "job_id": "uuid",
  "rating": 5,
  "comment": "Excellent work, very professional!"
}

Response:
{
  "review": {
    "id": "uuid",
    "job_id": "uuid",
    "reviewer_id": "uuid",
    "reviewee_id": "uuid",
    "rating": 5,
    "comment": "...",
    "created_at": "2026-05-12T..."
  },
  "msg": "Rating submitted successfully"
}

### Get My Job Requests
GET /customer/my-job-requests

Response:
{
  "job_requests": [...]
}

### Get My Jobs
GET /customer/my-jobs

Response:
{
  "jobs": [...]
}

---

## Artisan/Worker Endpoints

### Subscribe to Job Type
POST /worker/subscribe

Request:
{
  "job_type_id": "uuid"
}

Response:
{
  "subscription": {
    "id": "uuid",
    "user_id": "uuid",
    "job_type_id": "uuid",
    "created_at": "2026-05-12T..."
  },
  "msg": "Successfully subscribed to job type notifications"
}

### Unsubscribe
POST /worker/unsubscribe

Request:
{
  "job_type_id": "uuid"
}

Response:
{
  "success": true,
  "msg": "Successfully unsubscribed from job type"
}

### Get My Subscriptions
GET /worker/subscriptions

Response:
{
  "subscriptions": [...]
}

### Get Available Jobs
GET /worker/jobs

Returns jobs matching your subscriptions.

Response:
{
  "jobs": [
    {
      "id": "uuid",
      "customer_id": "uuid",
      "job_type_id": "uuid",
      "title": "Fix leaking sink",
      "description": "...",
      "location": "Lagos",
      "budget": 15000,
      "status": "open",
      "created_at": "2026-05-12T..."
    }
  ]
}

### Real-time Job Stream (SSE)
GET /worker/jobs/stream

Server-Sent Events endpoint. Sends job updates every 10 seconds.

Example with curl:
curl -N -H "Authorization: Bearer <token>" http://localhost:8080/api/v1/worker/jobs/stream

Events:
data: {"type":"connected","message":"Connected to job stream"}
data: {"type":"jobs","data":[...]}

### Accept Job
POST /worker/accept-job

Request:
{
  "job_request_id": "uuid",
  "proposed_amount": 15000
}

Response:
{
  "job": {...},
  "msg": "Job accepted successfully"
}

### Mark Job Complete
POST /worker/complete-job/:job_id

Response:
{
  "success": true,
  "msg": "Job marked as in progress. Waiting for customer confirmation."
}

### Get My Jobs
GET /worker/my-jobs

Response:
{
  "jobs": [...]
}

### Rate Customer
POST /worker/rate-customer

Request:
{
  "job_id": "uuid",
  "rating": 5,
  "comment": "Great customer, clear communication!"
}

Response:
{
  "review": {...},
  "msg": "Customer rated successfully"
}

---

## Matching & Job Types

### Get Job Types
GET /matching/job-types

Response:
[
  {
    "id": "uuid",
    "name": "Plumbing",
    "description": "Plumbing and pipe fitting services"
  },
  {
    "id": "uuid",
    "name": "Electrical",
    "description": "Electrical installation and repairs"
  }
]

---

## Error Responses

All errors follow this format:

{
  "msg": "Error message here",
  "code": 400
}

Common status codes:
- 400: Bad request (invalid input)
- 401: Unauthorized (missing/invalid token)
- 404: Not found
- 409: Conflict (duplicate record)
- 422: Validation error
- 500: Server error

Validation errors include details:
{
  "msg": "Validation error",
  "code": 422,
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}

---

## How It Works

1. Customer signs up and browses artisan profiles
2. Customer posts a job request
3. Artisan (subscribed to that job type) sees the job
4. Artisan accepts the job
5. Customer logs payment after Squad transaction
6. Both parties mark job as complete
7. Both parties rate each other
8. Reputation scores update automatically

## Reputation System

Calculated automatically after each review:
- Credit Score: (Average rating × 20) = 0-100
- Completion Rate: (Completed jobs / Total jobs) × 100
- Total Jobs: Count of completed jobs
- Average Rating: Mean of all ratings (1-5 stars)

## AI Matching

When browsing with `job_type_id` parameter:
- 70% Traditional: Skills match, location proximity, reputation
- 30% AI Semantic: LLM analyzes job description and artisan profiles for contextual fit

Result: Workers ranked by combined score with AI explanation.
