#!/bin/sh
set -e

echo "Checking required environment variables..."

REQUIRED_VARS="DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_DATABASE JWT_SECRET"

MISSING=""
for var in $REQUIRED_VARS; do
  eval value=\$$var
  if [ -z "$value" ]; then
    MISSING="$MISSING $var"
  fi
done

if [ -n "$MISSING" ]; then
  echo "❌ ERROR: Missing required environment variables:$MISSING"
  echo ""
  echo "Please set these in your .env file:"
  for var in $MISSING; do
    echo "  $var=..."
  done
  exit 1
fi

echo "✅ All required environment variables are set"
echo ""

exec "$@"
