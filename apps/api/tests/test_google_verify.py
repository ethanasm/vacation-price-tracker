"""Tests for Google ID-token verification (offline, with a locally-minted key)."""

import time

import pytest
from app.core.google_verify import (
    GoogleIdentity,
    GoogleTokenError,
    verify_google_id_token,
)
from authlib.jose import JsonWebKey
from authlib.jose import jwt as jose_jwt

ISSUER = "https://accounts.google.com"
AUDIENCE = "ios-client-id.apps.googleusercontent.com"


@pytest.fixture
def rsa_key():
    """A local RSA key standing in for Google's signing key."""
    return JsonWebKey.generate_key("RSA", 2048, is_private=True)


@pytest.fixture
def jwks(rsa_key):
    pub = rsa_key.as_dict(is_private=False)
    pub["kid"] = "test-kid"
    return {"keys": [pub]}


def _mint(rsa_key, claims: dict) -> str:
    header = {"alg": "RS256", "kid": "test-kid"}
    return jose_jwt.encode(header, claims, rsa_key).decode("ascii")


def _claims(**overrides) -> dict:
    base = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "sub": "google-sub-123",
        "email": "user@example.com",
        "email_verified": True,
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
    }
    base.update(overrides)
    return base


def test_valid_token_returns_identity(rsa_key, jwks):
    token = _mint(rsa_key, _claims())
    identity = verify_google_id_token(token, [AUDIENCE], jwks=jwks)
    assert isinstance(identity, GoogleIdentity)
    assert identity.sub == "google-sub-123"
    assert identity.email == "user@example.com"
    assert identity.email_verified is True


def test_wrong_audience_rejected(rsa_key, jwks):
    token = _mint(rsa_key, _claims(aud="some-other-client-id"))
    with pytest.raises(GoogleTokenError):
        verify_google_id_token(token, [AUDIENCE], jwks=jwks)


def test_wrong_issuer_rejected(rsa_key, jwks):
    token = _mint(rsa_key, _claims(iss="https://evil.example.com"))
    with pytest.raises(GoogleTokenError):
        verify_google_id_token(token, [AUDIENCE], jwks=jwks)


def test_expired_token_rejected(rsa_key, jwks):
    token = _mint(rsa_key, _claims(exp=int(time.time()) - 10))
    with pytest.raises(GoogleTokenError):
        verify_google_id_token(token, [AUDIENCE], jwks=jwks)


def test_missing_sub_or_email_rejected(rsa_key, jwks):
    token = _mint(rsa_key, _claims(sub=None))
    with pytest.raises(GoogleTokenError):
        verify_google_id_token(token, [AUDIENCE], jwks=jwks)


def test_garbage_token_rejected(jwks):
    with pytest.raises(GoogleTokenError):
        verify_google_id_token("not.a.jwt", [AUDIENCE], jwks=jwks)
