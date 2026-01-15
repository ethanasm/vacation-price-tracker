# SSL Certificates for Local Development

This directory contains SSL certificates for running the application with HTTPS in local development.

## Quick Start

### Generate Certificates (mkcert)

For a better experience without browser security warnings:

```bash
# Install mkcert
brew install mkcert  # macOS
# or: choco install mkcert  # Windows
# or: sudo apt install mkcert  # Ubuntu/Debian

# Install local Certificate Authority
mkcert -install

# Generate trusted certificates (from repo root)
mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost-cert.pem localhost 127.0.0.1 ::1
```

## Usage

Once certificates are generated, start the development servers:

```bash
# Terminal 1: API with HTTPS
pnpm api:dev

# Terminal 2: Web with HTTPS
pnpm web:dev
```

Access the application at:
- Web: https://localhost:3000
- API: https://localhost:8000
- API Docs: https://localhost:8000/docs

## Browser Security Warnings

### mkcert Certificates
No warnings! The certificates are trusted by your system.

## Files (Git Ignored)

The following files are generated and **not** committed to git:
- `localhost-cert.pem` - SSL certificate
- `localhost-key.pem` - Private key
- `*.crt`, `*.key` - Any other cert formats

## Troubleshooting

### "Certificate not found" Error
Recreate certificates with mkcert:
```bash
mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost-cert.pem localhost 127.0.0.1 ::1
```

### Remove a Trusted Self-Signed Cert
If you previously trusted a self-signed `localhost` cert in the System keychain, remove it:
```bash
sudo security delete-certificate -Z <SHA1_HASH> /Library/Keychains/System.keychain
```
Find the SHA-1 hash by listing matching certs:
```bash
security find-certificate -a -c "localhost" -Z /Library/Keychains/System.keychain
```
You can also remove it via Keychain Access by searching for `localhost`.

### Port Already in Use
Check if another process is using ports 3000 or 8000:
```bash
lsof -i :3000
lsof -i :8000
```

### Certificate Expired
Regenerate with mkcert:
```bash
rm localhost-cert.pem localhost-key.pem
mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost-cert.pem localhost 127.0.0.1 ::1
```

## Why HTTPS in Development?

1. **OAuth Requirements**: Google OAuth requires HTTPS callback URLs in production. Using HTTPS locally (with Cloudflare Tunnel/ngrok) matches this.
2. **Cookie Security**: Test secure cookies and SameSite attributes.
3. **Mixed Content**: Avoid warnings when loading resources.
4. **Production Parity**: Match production environment behavior.

## Security Note

⚠️ These certificates are for **local development only**. Never use self-signed certificates in production!

For production, use:
- Let's Encrypt (free)
- Cloud provider managed certificates (AWS ACM, Google Cloud Certificate Manager)
- Commercial SSL providers
