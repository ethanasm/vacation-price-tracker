"""Static checks over the Alembic migration scripts.

These guard invariants that only surface when ``alembic upgrade head`` runs
against a real Postgres — which no unit test does (the suite runs on SQLite
built from models). The one that motivated this file: alembic stores the
current revision in ``alembic_version.version_num VARCHAR(32)``, so a revision
id longer than 32 characters makes every upgrade fail *while recording the
version row* and roll the migration back. That broke prod deploys and starved
the mobile-e2e stack of schema (see 012_purge_failed_snapshots).
"""

import re
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parents[1] / "migrations" / "versions"

# alembic's default version table column: VARCHAR(32)
ALEMBIC_VERSION_NUM_MAX_LEN = 32

_REVISION_RE = re.compile(r'^revision: str = "(?P<rev>[^"]+)"$', re.MULTILINE)
_DOWN_REVISION_RE = re.compile(r'^down_revision: str \| None = (?:"(?P<rev>[^"]+)"|None)$', re.MULTILINE)


def _load_revisions() -> dict[str, str | None]:
    """Map revision id -> down_revision for every migration script."""
    revisions: dict[str, str | None] = {}
    for script in sorted(VERSIONS_DIR.glob("*.py")):
        source = script.read_text()
        match = _REVISION_RE.search(source)
        assert match, f"{script.name}: no revision declaration found"
        down_match = _DOWN_REVISION_RE.search(source)
        assert down_match, f"{script.name}: no down_revision declaration found"
        revisions[match.group("rev")] = down_match.group("rev")
    return revisions


def test_versions_dir_exists() -> None:
    assert VERSIONS_DIR.is_dir()
    assert list(VERSIONS_DIR.glob("*.py")), "no migration scripts found"


def test_revision_ids_fit_alembic_version_column() -> None:
    over_limit = {rev: len(rev) for rev in _load_revisions() if len(rev) > ALEMBIC_VERSION_NUM_MAX_LEN}
    assert not over_limit, (
        f"revision ids exceed alembic_version.version_num VARCHAR"
        f"({ALEMBIC_VERSION_NUM_MAX_LEN}): {over_limit} — "
        "alembic upgrade head will fail writing the version row"
    )


def test_revision_chain_is_linear_and_complete() -> None:
    revisions = _load_revisions()
    down_revisions = [down for down in revisions.values() if down is not None]

    # Every down_revision must point at a known revision.
    unknown = [down for down in down_revisions if down not in revisions]
    assert not unknown, f"down_revision references unknown revisions: {unknown}"

    # Exactly one root and no two scripts sharing a parent (single linear head).
    roots = [rev for rev, down in revisions.items() if down is None]
    assert len(roots) == 1, f"expected one root migration, found: {roots}"
    assert len(set(down_revisions)) == len(down_revisions), (
        "multiple migrations share a down_revision (branched history)"
    )
