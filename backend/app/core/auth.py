"""Verify Supabase-issued JWTs. Supports both signing schemes Supabase uses:

* legacy projects: shared HS256 secret  (SUPABASE_JWT_SECRET)
* newer projects: asymmetric keys published at <project>/auth/v1/.well-known/jwks.json
"""
import uuid
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

bearer = HTTPBearer(auto_error=False)


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{url.rstrip('/')}/auth/v1/.well-known/jwks.json", cache_keys=True)


def decode_token(token: str) -> dict:
    s = get_settings()
    options = {"require": ["exp", "sub"]}
    if s.supabase_jwt_secret:
        return jwt.decode(token, s.supabase_jwt_secret, algorithms=["HS256"],
                          audience="authenticated", options=options)
    if not s.supabase_url:
        raise jwt.InvalidTokenError("auth is not configured")
    key = _jwks_client(s.supabase_url).get_signing_key_from_jwt(token).key
    return jwt.decode(token, key, algorithms=["ES256", "RS256"],
                      audience="authenticated", options=options)


def current_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> uuid.UUID:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        claims = decode_token(creds.credentials)
        return uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from None
