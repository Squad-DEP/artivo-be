# Supabase Connection Setup

## Get Your Credentials

1. Go to your Supabase project dashboard
2. Click **Settings** → **Database**
3. Scroll to **Connection string** → **URI**

You'll see something like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

## Update .env

```env
DB_DIALECT="postgres"
DB_HOST="db.xxxxxxxxxxxxx.supabase.co"
DB_PORT="5432"
DB_USERNAME="postgres"
DB_PASSWORD="your_actual_password"
DB_DATABASE="postgres"
```

## Run Migrations

```bash
npm run db:migrate
```

That's it! Your app now connects to Supabase.
