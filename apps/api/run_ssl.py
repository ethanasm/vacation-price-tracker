"""
Run FastAPI with SSL support for local development
"""

import logging
import os
from pathlib import Path

import uvicorn

# Get paths to SSL certificates
PROJECT_ROOT = Path(__file__).parent.parent.parent
CERT_DIR = PROJECT_ROOT / "certs"
SSL_KEYFILE = str(CERT_DIR / "localhost-key.pem")
SSL_CERTFILE = str(CERT_DIR / "localhost-cert.pem")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    # Check if certificates exist
    if not os.path.exists(SSL_KEYFILE) or not os.path.exists(SSL_CERTFILE):
        logging.error("SSL certificates not found.")
        logging.error("Expected: %s and %s", SSL_KEYFILE, SSL_CERTFILE)
        logging.error(
            "Run: mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost-cert.pem localhost 127.0.0.1 ::1"
        )
        exit(1)

    logging.info("Starting FastAPI with HTTPS enabled.")
    logging.info("Certificate: %s", SSL_CERTFILE)
    logging.info("Key: %s", SSL_KEYFILE)

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        ssl_keyfile=SSL_KEYFILE,
        ssl_certfile=SSL_CERTFILE,
    )
