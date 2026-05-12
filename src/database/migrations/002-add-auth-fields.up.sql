-- Add authentication fields to users table
ALTER TABLE users 
ADD COLUMN password VARCHAR(255),
ADD COLUMN password_reset_key VARCHAR(255),
ADD COLUMN email_verification_key VARCHAR(255),
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
