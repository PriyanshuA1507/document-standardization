from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
from app.schemas.user import UserOut
from app.services import auth_service, audit_service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user, return JWT tokens, and create audit log."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    user = await auth_service.authenticate_user(
        db, login_data.username, login_data.password
    )
    if not user:
        await audit_service.create_audit_log(
            db,
            action="USER_LOGIN_FAILED",
            status="FAILED",
            details={
                "attempted_username": login_data.username,
                "reason": "Invalid credentials",
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    tokens = await auth_service.create_session(
        db, user, ip_address=ip_address, user_agent=user_agent
    )

    role_names = [ur.role.role_name for ur in user.roles] if user.roles else []
    await audit_service.create_audit_log(
        db,
        action="USER_LOGIN",
        status="SUCCESS",
        user_id=user.user_id,
        details={
            "username": user.username,
            "roles": role_names,
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token using refresh token."""
    tokens = await auth_service.refresh_session(db, refresh_data.refresh_token)
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return tokens


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke all sessions for the current user and record audit log."""
    ip_address = request.client.host if request.client else None
    await auth_service.revoke_session(db, current_user.user_id)
    await audit_service.create_audit_log(
        db,
        action="USER_LOGOUT",
        status="SUCCESS",
        user_id=current_user.user_id,
        details={"username": current_user.username},
        ip_address=ip_address,
    )
    await db.commit()
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Get current user profile."""
    return UserOut.from_orm_with_roles(current_user)
