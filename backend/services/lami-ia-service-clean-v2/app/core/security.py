from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import get_settings

security = HTTPBearer(auto_error=False)


class CurrentUser:
    def __init__(self, user_id: str, email: str, role: str):
        self.user_id = user_id
        self.email = email
        self.role = role


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[CurrentUser]:
    if credentials is None:
        return None

    settings = get_settings()
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],
        )
        user_id = payload.get("user_id") or payload.get("sub")
        email = payload.get("email", "")
        role = payload.get("role", "client")
        if not user_id:
            return None
        return CurrentUser(user_id=user_id, email=email, role=role)
    except JWTError:
        return None


async def require_user(
    user: Optional[CurrentUser] = Depends(get_current_user),
) -> CurrentUser:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise",
        )
    return user
