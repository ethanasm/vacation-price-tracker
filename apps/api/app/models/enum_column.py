"""Column factory for StrEnum fields stored as VARCHAR.

A bare enum annotation on a SQLModel field makes SQLAlchemy emit a **native
Postgres ENUM type** (e.g. ``tripstatus``) — but the Alembic migrations define
these columns as ``VARCHAR(20)``, so on any migration-built database every
query against such a column fails with ``type "tripstatus" does not exist``.
This stayed invisible for months because the dev/prod/e2e databases were born
from ``create_all`` (which created the native types); it surfaced the moment
the e2e database was rebuilt from the migration chain.

``varchar_enum`` keeps the ergonomics of the enum annotation (params are sent
as the StrEnum *values*, rows load back as enum members, ``.value`` works on
loaded rows) while rendering a plain ``VARCHAR`` that matches the migrations:
``native_enum=False`` suppresses the Postgres type, ``values_callable`` stores
the lowercase values rather than the default member *names*, and
``create_constraint=False`` skips the CHECK constraint the migrations don't
have. Migration ``013_enum_cols_to_varchar`` converted the legacy native-enum
columns to this shape.
"""

from enum import Enum as PyEnum

import sqlalchemy as sa
from sqlalchemy import Column


def varchar_enum(
    enum_cls: type[PyEnum],
    *,
    server_default: str,
    length: int = 20,
) -> Column:
    """A VARCHAR-backed enum column matching the migrations' String(length)."""
    return Column(
        sa.Enum(
            enum_cls,
            native_enum=False,
            create_constraint=False,
            length=length,
            values_callable=lambda e: [member.value for member in e],
            # With no CHECK constraint, this is the only thing rejecting a raw
            # string that isn't a legal enum value at bind time.
            validate_strings=True,
        ),
        nullable=False,
        server_default=server_default,
    )
