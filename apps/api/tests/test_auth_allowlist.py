"""Tests for the sign-in allowlist gate."""

from app.core.auth_allowlist import (
    is_email_allowed,
    parse_allowlist,
    should_allow_sign_in,
)


class TestParseAllowlist:
    def test_none_and_empty(self):
        assert parse_allowlist(None) == []
        assert parse_allowlist("") == []
        assert parse_allowlist("   ") == []

    def test_splits_trims_lowercases_and_drops_blanks(self):
        assert parse_allowlist(" A@X.com, , B@Y.COM ,") == ["a@x.com", "b@y.com"]


class TestIsEmailAllowed:
    def test_open_signup_when_no_allowlist(self):
        assert is_email_allowed("anyone@example.com", emails=[], domains=[]) is True
        # Even a missing email is allowed when nothing is configured.
        assert is_email_allowed(None, emails=[], domains=[]) is True

    def test_missing_email_denied_when_allowlist_set(self):
        assert is_email_allowed(None, emails=["a@x.com"], domains=[]) is False

    def test_exact_email_match_case_insensitive(self):
        assert is_email_allowed("A@X.com", emails=["a@x.com"], domains=[]) is True

    def test_domain_match(self):
        assert is_email_allowed("someone@team.io", emails=[], domains=["team.io"]) is True

    def test_no_match(self):
        assert is_email_allowed("nope@other.com", emails=["a@x.com"], domains=["team.io"]) is False


class TestShouldAllowSignIn:
    def test_unverified_email_denied(self):
        assert (
            should_allow_sign_in(
                email="a@x.com", email_verified=False, emails=["a@x.com"], domains=[]
            )
            is False
        )

    def test_verified_allowed(self):
        assert (
            should_allow_sign_in(
                email="a@x.com", email_verified=True, emails=["a@x.com"], domains=[]
            )
            is True
        )

    def test_verified_none_defers_to_allowlist(self):
        # Google normally sends email_verified; treat absent as not-false.
        assert (
            should_allow_sign_in(
                email="a@x.com", email_verified=None, emails=[], domains=[]
            )
            is True
        )
        assert (
            should_allow_sign_in(
                email="nope@y.com", email_verified=None, emails=["a@x.com"], domains=[]
            )
            is False
        )
