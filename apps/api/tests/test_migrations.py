"""Static checks over the Alembic migration scripts.

These guard invariants that only surface when ``alembic upgrade head`` runs
against a real Postgres — which no unit test does (the suite runs on SQLite
built from models). The one that motivated this file: alembic stores the
current revision in ``alembic_version.version_num VARCHAR(32)``, so a revision
id longer than 32 characters makes every upgrade fail *while recording the
version row* and roll the migration back. That broke prod deploys and starved
the mobile-e2e stack of schema (see 012_purge_failed_snapshots). CI also runs
the chain against a real Postgres (server.yml "Migrations against Postgres"),
which catches what static checks can't; these tests fail faster and locally.
"""

import ast
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parents[1] / "migrations" / "versions"

# alembic's default version table column: VARCHAR(32)
ALEMBIC_VERSION_NUM_MAX_LEN = 32


def _extract_str_assignment(tree: ast.Module, name: str) -> tuple[bool, str | None]:
    """Return (found, value) for a module-level ``name = <str|None>`` assignment.

    Handles both plain and annotated assignments so the check is robust to the
    template's quoting/annotation style (``script.py.mako`` emits un-annotated
    ``repr()`` values; the checked-in files use annotated double-quoted ones).
    """
    for node in tree.body:
        targets: list[ast.expr]
        if isinstance(node, ast.Assign):
            targets = node.targets
            value = node.value
        elif isinstance(node, ast.AnnAssign) and node.value is not None:
            targets = [node.target]
            value = node.value
        else:
            continue
        for target in targets:
            if isinstance(target, ast.Name) and target.id == name:
                if isinstance(value, ast.Constant) and (value.value is None or isinstance(value.value, str)):
                    return True, value.value
                raise AssertionError(f"{name} is not a plain string/None constant: {ast.dump(value)}")
    return False, None


def _load_revisions() -> list[tuple[str, str, str | None]]:
    """Return (filename, revision, down_revision) for every migration script."""
    scripts = sorted(VERSIONS_DIR.rglob("*.py"))
    assert scripts, "no migration scripts found"
    entries: list[tuple[str, str, str | None]] = []
    for script in scripts:
        tree = ast.parse(script.read_text(), filename=str(script))
        rev_found, rev = _extract_str_assignment(tree, "revision")
        assert rev_found, f"{script.name}: no revision declaration found"
        assert isinstance(rev, str), f"{script.name}: revision must be a string, got {rev!r}"
        down_found, down = _extract_str_assignment(tree, "down_revision")
        assert down_found, f"{script.name}: no down_revision declaration found"
        entries.append((script.name, rev, down))
    return entries


def test_no_native_enum_model_columns() -> None:
    """Every enum-typed model column must render as VARCHAR, never a native ENUM.

    The migrations declare these columns as ``sa.String(20)``; a bare enum
    annotation makes SQLModel emit a native Postgres ENUM type instead, so the
    models and migrations describe two different schemas. On a migration-built
    database every query against such a column fails with
    ``type "tripstatus" does not exist`` (found when the e2e DB was rebuilt
    from the chain); on a create_all-built database the varchar-emitting side
    fails with ``operator does not exist: <type> = character varying``. Use
    ``app.models.enum_column.varchar_enum`` for enum fields — it also stores
    the StrEnum *values* (checked here too: without ``values_callable``,
    SQLAlchemy stores the member *names*, e.g. ``ACTIVE`` instead of
    ``active``).
    """
    import app.models  # noqa: F401 — registers every table on the metadata
    import sqlalchemy as sa
    from sqlmodel import SQLModel

    native = []
    wrong_values = []
    for table in SQLModel.metadata.tables.values():
        for col in table.columns:
            if not isinstance(col.type, sa.Enum):
                continue
            qualified = f"{table.name}.{col.name}"
            if col.type.native_enum:
                native.append(qualified)
            expected = sorted(m.value for m in col.type.enum_class)
            if sorted(col.type.enums) != expected:
                wrong_values.append((qualified, sorted(col.type.enums), expected))
    assert not native, (
        f"model columns emit native Postgres ENUM types (migrations declare "
        f"VARCHAR): {native} — use varchar_enum() from app.models.enum_column"
    )
    assert not wrong_values, (
        f"enum columns store member names instead of StrEnum values "
        f"(missing values_callable): {wrong_values}"
    )


def test_revision_ids_fit_alembic_version_column() -> None:
    over_limit = {rev: len(rev) for _, rev, _ in _load_revisions() if len(rev) > ALEMBIC_VERSION_NUM_MAX_LEN}
    assert not over_limit, (
        f"revision ids exceed alembic_version.version_num VARCHAR"
        f"({ALEMBIC_VERSION_NUM_MAX_LEN}): {over_limit} — "
        "alembic upgrade head will fail writing the version row"
    )


def test_revision_chain_is_linear_and_complete() -> None:
    entries = _load_revisions()

    revisions = [rev for _, rev, _ in entries]
    assert len(set(revisions)) == len(revisions), f"duplicate revision ids across scripts: {sorted(revisions)}"
    by_rev = {rev: down for _, rev, down in entries}

    # Every down_revision must point at a known revision.
    unknown = [(name, down) for name, _, down in entries if down is not None and down not in by_rev]
    assert not unknown, f"down_revision references unknown revisions: {unknown}"

    # Exactly one root, and no two scripts sharing a parent (no branches).
    roots = [rev for rev, down in by_rev.items() if down is None]
    assert len(roots) == 1, f"expected one root migration, found: {roots}"
    children: dict[str, list[str]] = {}
    for rev, down in by_rev.items():
        if down is not None:
            children.setdefault(down, []).append(rev)
    branched = {parent: kids for parent, kids in children.items() if len(kids) > 1}
    assert not branched, f"multiple migrations share a down_revision: {branched}"

    # Walk root → head; every revision must be reachable (no cycles or islands
    # — {A: None, B: C, C: B} passes the checks above but is not a chain).
    walked = 1
    current = roots[0]
    while current in children:
        current = children[current][0]
        walked += 1
    assert walked == len(by_rev), (
        f"revision chain from root {roots[0]!r} covers {walked} of "
        f"{len(by_rev)} scripts — disconnected or cyclic revisions exist"
    )
