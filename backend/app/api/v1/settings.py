"""Settings, sending preferences, DNC list, and master profile API router."""
from fastapi import APIRouter, Depends
from app.api.deps import get_profile_repo, get_settings_repo
from app.repositories.domain import ProfileRepo, SettingsRepo
from app.schemas.domain import (
    DncRequest,
    ExpItem,
    PrefsResponse,
    PrefsUpdateRequest,
    ProfileResponse,
    ProfileUpdateRequest,
)

router = APIRouter(tags=["Settings & Profile"])


@router.get("/settings", response_model=PrefsResponse)
async def get_settings(repo: SettingsRepo = Depends(get_settings_repo)):
    """Get tenant sending preferences and limits."""
    s = await repo.get_or_create()
    return PrefsResponse(
        tone=s.tone,  # type: ignore
        provider=s.provider,  # type: ignore
        fallback=s.fallback,
        daily_cap=s.daily_cap,
        delay_sec=s.delay_sec,
        dnc=s.dnc,
        signature=s.signature
    )


@router.put("/settings", response_model=PrefsResponse)
async def update_settings(
    body: PrefsUpdateRequest,
    repo: SettingsRepo = Depends(get_settings_repo)
):
    """Update tenant sending preferences."""
    s = await repo.get_or_create()
    if body.tone is not None:
        s.tone = body.tone
    if body.provider is not None:
        s.provider = body.provider
    if body.fallback is not None:
        s.fallback = body.fallback
    if body.daily_cap is not None:
        s.daily_cap = body.daily_cap
    if body.delay_sec is not None:
        s.delay_sec = body.delay_sec
    if body.signature is not None:
        s.signature = body.signature
    await s.save()
    return PrefsResponse(
        tone=s.tone,  # type: ignore
        provider=s.provider,  # type: ignore
        fallback=s.fallback,
        daily_cap=s.daily_cap,
        delay_sec=s.delay_sec,
        dnc=s.dnc,
        signature=s.signature
    )


@router.post("/settings/dnc", response_model=PrefsResponse)
async def add_dnc_entry(
    body: DncRequest,
    repo: SettingsRepo = Depends(get_settings_repo)
):
    """Add email address or domain to do-not-contact list."""
    s = await repo.add_dnc(body.email)
    return PrefsResponse(
        tone=s.tone,  # type: ignore
        provider=s.provider,  # type: ignore
        fallback=s.fallback,
        daily_cap=s.daily_cap,
        delay_sec=s.delay_sec,
        dnc=s.dnc,
        signature=s.signature
    )


@router.delete("/settings/dnc", response_model=PrefsResponse)
async def remove_dnc_entry(
    body: DncRequest,
    repo: SettingsRepo = Depends(get_settings_repo)
):
    """Remove email address or domain from do-not-contact list."""
    s = await repo.remove_dnc(body.email)
    return PrefsResponse(
        tone=s.tone,  # type: ignore
        provider=s.provider,  # type: ignore
        fallback=s.fallback,
        daily_cap=s.daily_cap,
        delay_sec=s.delay_sec,
        dnc=s.dnc,
        signature=s.signature
    )


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(repo: ProfileRepo = Depends(get_profile_repo)):
    """Get master profile."""
    p = await repo.get_or_create()
    return ProfileResponse(
        name=p.name,
        email=p.email,
        headline=p.headline,
        skills=p.skills,
        experience=[ExpItem(**e) for e in p.experience],
        projects=[ExpItem(**pr) for pr in p.projects],
        education=p.education,
        links=p.links
    )


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    repo: ProfileRepo = Depends(get_profile_repo)
):
    """Update master profile."""
    p = await repo.get_or_create()
    if body.name is not None:
        p.name = body.name
    if body.email is not None:
        p.email = body.email
    if body.headline is not None:
        p.headline = body.headline
    if body.skills is not None:
        p.skills = body.skills
    if body.experience is not None:
        p.experience = [e.model_dump() for e in body.experience]
    if body.projects is not None:
        p.projects = [pr.model_dump() for pr in body.projects]
    if body.education is not None:
        p.education = body.education
    if body.links is not None:
        p.links = body.links
    await p.save()

    return ProfileResponse(
        name=p.name,
        email=p.email,
        headline=p.headline,
        skills=p.skills,
        experience=[ExpItem(**e) for e in p.experience],
        projects=[ExpItem(**pr) for pr in p.projects],
        education=p.education,
        links=p.links
    )
