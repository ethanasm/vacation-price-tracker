#!/bin/sh
set -e

# Check if SSL certificates exist
if [ -f /app/certs/localhost-key.pem ] && [ -f /app/certs/localhost-cert.pem ]; then
    echo "🔐 SSL certificates found - starting with HTTPS"
    exec python run_ssl.py
else
    echo "⚠️  No SSL certificates found - starting with HTTP"
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000
fi
