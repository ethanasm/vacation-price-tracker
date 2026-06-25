"""Request/response models for the mobile device-token registration endpoint."""

from pydantic import BaseModel


class DeviceTokenRegister(BaseModel):
    """Register/unregister payload: the Expo push token + originating platform."""

    expo_push_token: str
    platform: str


class DeviceTokenResponse(BaseModel):
    """The registered token (echoed back to confirm the upsert)."""

    expo_push_token: str
    platform: str
