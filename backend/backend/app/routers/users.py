import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles, get_current_user
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserOut, UserListOut, ProfileUpdate
from app.services import user_service, audit_service

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.put("/me", response_model=UserOut)
async def update_my_profile(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's own profile."""
    try:
        user = await user_service.update_user(
            db,
            user_id=current_user.user_id,
            email=profile_data.email,
            full_name=profile_data.full_name,
        )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        await audit_service.create_audit_log(
            db,
            action="PROFILE_UPDATE",
            status="SUCCESS",
            user_id=current_user.user_id,
            details={"email": profile_data.email, "full_name": profile_data.full_name},
        )
        await db.commit()
        return UserOut.from_orm_with_roles(user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("", response_model=UserListOut)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_roles("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """List all users (admin only)."""
    users, total = await user_service.get_users(db, skip=skip, limit=limit)
    return UserListOut(
        users=[UserOut.from_orm_with_roles(u) for u in users],
        total=total,
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_roles("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user (admin only)."""
    try:
        user = await user_service.create_user(
            db,
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name,
            role_names=user_data.roles,
        )
        await audit_service.create_audit_log(
            db,
            action="USER_CREATE",
            status="SUCCESS",
            user_id=current_user.user_id,
            details={
                "created_user_id": str(user.user_id),
                "created_username": user.username,
                "email": user.email,
                "roles": user_data.roles,
            },
        )
        await db.commit()
        return UserOut.from_orm_with_roles(user)
    except ValueError as e:
        await audit_service.create_audit_log(
            db,
            action="USER_CREATE",
            status="FAILED",
            user_id=current_user.user_id,
            details={"attempted_username": user_data.username, "reason": str(e)},
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    user_data: UserUpdate,
    current_user: User = Depends(require_roles("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Update a user (admin only)."""
    try:
        user = await user_service.update_user(
            db,
            user_id=user_id,
            email=user_data.email,
            full_name=user_data.full_name,
            is_active=user_data.is_active,
            role_names=user_data.roles,
        )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        await audit_service.create_audit_log(
            db,
            action="USER_UPDATE",
            status="SUCCESS",
            user_id=current_user.user_id,
            details={
                "target_user_id": str(user_id),
                "target_username": user.username,
                "email": user_data.email,
                "is_active": user_data.is_active,
                "roles": user_data.roles,
            },
        )
        await db.commit()
        return UserOut.from_orm_with_roles(user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_roles("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a user (admin only)."""
    if user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    user = await user_service.get_user_by_id(db, user_id)
    target_username = user.username if user else str(user_id)

    success = await user_service.delete_user(db, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    await audit_service.create_audit_log(
        db,
        action="USER_DELETE",
        status="SUCCESS",
        user_id=current_user.user_id,
        details={
            "deactivated_user_id": str(user_id),
            "deactivated_username": target_username,
        },
    )
    await db.commit()
    return {"message": "User deactivated successfully"}
