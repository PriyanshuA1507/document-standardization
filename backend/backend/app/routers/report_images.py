import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.report import Report, ReportImage
from app.schemas.report import ReportImageOut, ReportImageListOut
from app.services import report_service
from app.utils.seaweedfs_utils import get_file_bytes

import json
import logging
from sqlalchemy import delete

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["Report Images"])


async def sync_report_images_from_dict(db: AsyncSession, report_id: uuid.UUID, manifest: dict) -> bool:
    """Sync report images into DB from an in-memory manifest dict."""
    if not manifest:
        return False
    try:
        # Delete prior images for this report
        await db.execute(delete(ReportImage).where(ReportImage.report_id == report_id))

        # 1. Figures
        figures_map = manifest.get("images", {})
        if isinstance(figures_map, dict):
            for tag, img_info in figures_map.items():
                if not isinstance(img_info, dict):
                    continue
                img_row = ReportImage(
                    report_id=report_id,
                    tag=img_info.get("tag") or tag or "",
                    page=int(img_info.get("page", 1)),
                    figure=int(img_info.get("figure", 1)),
                    sha256=str(img_info.get("sha256", "")),
                    seaweed_path=str(img_info.get("uri", "")),
                    format=str(img_info.get("format", "png")),
                    width=int(img_info.get("width", 0)),
                    height=int(img_info.get("height", 0)),
                    bbox=img_info.get("bbox"),
                    is_figure=True,
                )
                db.add(img_row)

        # 2. Layout images
        layout_list = manifest.get("layout_images", [])
        if isinstance(layout_list, list):
            for img_info in layout_list:
                if not isinstance(img_info, dict):
                    continue
                img_row = ReportImage(
                    report_id=report_id,
                    tag="",
                    page=int(img_info.get("page", 1)),
                    figure=0,
                    sha256=str(img_info.get("sha256", "")),
                    seaweed_path=str(img_info.get("uri", "")),
                    format=str(img_info.get("format", "png")),
                    width=int(img_info.get("width", 0)),
                    height=int(img_info.get("height", 0)),
                    bbox=img_info.get("bbox"),
                    is_figure=False,
                )
                db.add(img_row)

        await db.commit()
        return True
    except Exception as e:
        logger.error(f"Error syncing report images for {report_id}: {e}")
        await db.rollback()
        return False


async def sync_report_images_from_seaweedfs(db: AsyncSession, report_id: uuid.UUID) -> bool:
    """Read manifest from SeaweedFS images/{report_id}/manifest.json and sync into PostgreSQL."""
    try:
        raw_bytes = get_file_bytes(f"images/{report_id}/manifest.json")
        manifest = json.loads(raw_bytes.decode("utf-8"))
        return await sync_report_images_from_dict(db, report_id, manifest)
    except Exception as e:
        logger.debug(f"Could not read manifest from SeaweedFS for {report_id}: {e}")
        return False


@router.get("/{report_id}/images", response_model=ReportImageListOut)
async def list_report_images(
    report_id: uuid.UUID,
    is_figure: Optional[bool] = Query(None, description="Filter only figures (true) or layout images (false)"),
    page: Optional[int] = Query(None, ge=1, description="Filter by page number"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all images extracted from a report (figures and/or layout elements).
    Self-heals from SeaweedFS if images were stored in storage but not yet registered in DB.
    """
    # 1. Verify report exists
    report = await report_service.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    # 2. Build query
    query = select(ReportImage).where(ReportImage.report_id == report_id)
    if is_figure is not None:
        query = query.where(ReportImage.is_figure == is_figure)
    if page is not None:
        query = query.where(ReportImage.page == page)

    query = query.order_by(ReportImage.page.asc(), ReportImage.figure.asc(), ReportImage.created_at.asc())
    result = await db.execute(query)
    images = result.scalars().all()

    # Self-healing: if no images in DB, check if SeaweedFS has an existing manifest
    if len(images) == 0:
        synced = await sync_report_images_from_seaweedfs(db, report_id)
        if synced:
            result = await db.execute(query)
            images = result.scalars().all()

    # Also compute overall figure/layout counts for this report
    count_query = (
        select(
            ReportImage.is_figure,
            func.count(ReportImage.image_id),
        )
        .where(ReportImage.report_id == report_id)
        .group_by(ReportImage.is_figure)
    )
    count_res = await db.execute(count_query)
    counts = dict(count_res.all())
    figure_count = counts.get(True, 0)
    layout_count = counts.get(False, 0)

    return ReportImageListOut(
        images=[ReportImageOut.model_validate(img) for img in images],
        total=len(images),
        figure_count=figure_count,
        layout_count=layout_count,
    )



@router.get("/{report_id}/images/{image_id}", response_model=ReportImageOut)
async def get_report_image(
    report_id: uuid.UUID,
    image_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get metadata for a specific image extracted from a report.
    """
    query = select(ReportImage).where(
        ReportImage.report_id == report_id,
        ReportImage.image_id == image_id,
    )
    result = await db.execute(query)
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found for this report",
        )
    return ReportImageOut.model_validate(img)


@router.get("/{report_id}/images/{image_id}/download")
async def download_report_image(
    report_id: uuid.UUID,
    image_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Download or view image bytes from SeaweedFS for a specific extracted image.
    """
    query = select(ReportImage).where(
        ReportImage.report_id == report_id,
        ReportImage.image_id == image_id,
    )
    result = await db.execute(query)
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found for this report",
        )

    try:
        data = get_file_bytes(img.seaweed_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image file could not be retrieved from SeaweedFS: {str(e)}",
        )

    clean_tag = img.tag.replace("[", "").replace("]", "").strip() or img.sha256[:12]
    filename = f"{clean_tag}.{img.format}"

    media_type = f"image/{img.format}"
    if img.format.lower() in ("jpg", "jpeg"):
        media_type = "image/jpeg"
    elif img.format.lower() == "png":
        media_type = "image/png"

    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{report_id}/images/by-tag/{tag:path}", response_model=ReportImageOut)
async def get_report_image_by_tag(
    report_id: uuid.UUID,
    tag: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Find an extracted image by its tag (e.g. `[IMAGE_PAGE_3_FIG_1]` or `IMAGE_PAGE_3_FIG_1`).
    """
    tag_norm = tag.strip()
    tag_with_brackets = f"[{tag_norm}]" if not tag_norm.startswith("[") else tag_norm
    tag_without_brackets = tag_norm.lstrip("[").rstrip("]")

    query = select(ReportImage).where(
        ReportImage.report_id == report_id,
        ReportImage.tag.in_([tag_norm, tag_with_brackets, tag_without_brackets]),
    )
    result = await db.execute(query)
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image with tag '{tag}' not found for report {report_id}",
        )
    return ReportImageOut.model_validate(img)


@router.get("/{report_id}/images/by-tag/{tag:path}/download")
async def download_report_image_by_tag(
    report_id: uuid.UUID,
    tag: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Stream image bytes directly by looking up its pointer tag (e.g. `[IMAGE_PAGE_3_FIG_1]`).
    Enables inline rendering in web markdown or finding views:
    `<img src="/api/reports/{report_id}/images/by-tag/[IMAGE_PAGE_3_FIG_1]/download" />`
    """
    tag_norm = tag.strip()
    tag_with_brackets = f"[{tag_norm}]" if not tag_norm.startswith("[") else tag_norm
    tag_without_brackets = tag_norm.lstrip("[").rstrip("]")

    query = select(ReportImage).where(
        ReportImage.report_id == report_id,
        ReportImage.tag.in_([tag_norm, tag_with_brackets, tag_without_brackets]),
    )
    result = await db.execute(query)
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image with tag '{tag}' not found for report {report_id}",
        )

    try:
        data = get_file_bytes(img.seaweed_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image file could not be retrieved from SeaweedFS: {str(e)}",
        )

    clean_tag = img.tag.replace("[", "").replace("]", "").strip() or img.sha256[:12]
    filename = f"{clean_tag}.{img.format}"

    media_type = f"image/{img.format}"
    if img.format.lower() in ("jpg", "jpeg"):
        media_type = "image/jpeg"
    elif img.format.lower() == "png":
        media_type = "image/png"

    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{report_id}/images-manifest")
async def get_report_images_manifest(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the complete image manifest for this report.
    Attempts to read images/{report_id}/manifest.json from SeaweedFS first;
    if unavailable, reconstructs the manifest from the database report_images table.
    """
    import json
    report = await report_service.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    # 1. Try reading directly from SeaweedFS
    try:
        raw_bytes = get_file_bytes(f"images/{report_id}/manifest.json")
        return json.loads(raw_bytes.decode("utf-8"))
    except Exception:
        pass

    # 2. Reconstruct from DB
    query = select(ReportImage).where(ReportImage.report_id == report_id).order_by(ReportImage.page.asc(), ReportImage.figure.asc())
    result = await db.execute(query)
    images = result.scalars().all()

    figures_dict = {}
    layout_list = []
    for img in images:
        item = {
            "tag": img.tag,
            "page": img.page,
            "figure": img.figure,
            "sha256": img.sha256,
            "uri": img.seaweed_path,
            "format": img.format,
            "width": img.width,
            "height": img.height,
            "bbox": img.bbox,
        }
        if img.is_figure:
            figures_dict[img.tag] = item
        else:
            layout_list.append(item)

    return {
        "report_id": str(report_id),
        "source_file": report.original_filename,
        "images": figures_dict,
        "layout_images": layout_list,
    }
