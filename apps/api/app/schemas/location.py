"""Location reference data schemas."""

from pydantic import BaseModel, Field


class LocationResult(BaseModel):
    """Airport or city location result."""

    code: str = Field(description="IATA location code")
    name: str = Field(description="Location name")
    type: str = Field(description="Location type (AIRPORT or CITY)")
