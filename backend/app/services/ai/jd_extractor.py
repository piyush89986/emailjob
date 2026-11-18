"""Job description extractor with SSRF-protected URL fetching and structured extraction."""
import ipaddress
import re
import socket
from typing import Optional
from urllib.parse import urlparse
import httpx
from pydantic import BaseModel
from app.core.errors import AppError
from app.core.logging import get_logger
from app.schemas.domain import ExtractJdResponse
from app.services.ai.llm_router import LLMRouter

log = get_logger("jd_extractor")

KNOWN_SKILLS = [
    "python", "fastapi", "react", "typescript", "javascript", "node", "mongodb",
    "sql", "postgres", "docker", "kubernetes", "aws", "gcp", "redis", "graphql",
    "rest", "git", "tailwind", "next.js", "java", "django", "flask", "machine learning",
    "llm", "ci/cd"
]


def _is_safe_url(url: str) -> bool:
    """Validate that the target URL does not resolve to private, loopback, or cloud metadata addresses."""
    parsed = urlparse(url)
    if parsed.scheme not in ["http", "https"]:
        return False

    hostname = parsed.hostname
    if not hostname:
        return False

    if hostname.lower() in ["localhost", "127.0.0.1", "0.0.0.0", "metadata.google.internal"]:
        return False

    try:
        # Resolve hostname to IP
        addr_infos = socket.getaddrinfo(hostname, None)
        for _, _, _, _, sockaddr in addr_infos:
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)
            if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
                return False
            # Block 169.254.169.254 (AWS/GCP/Azure metadata)
            if str(ip) == "169.254.169.254":
                return False
    except Exception:
        return False

    return True


class JdExtractor:
    @staticmethod
    async def extract_from_url_or_text(tenant_id: str, text: Optional[str] = None, url: Optional[str] = None) -> ExtractJdResponse:
        """Fetch URL safely if provided, then extract structured JD details."""
        jd_content = text or ""
        if url:
            if not _is_safe_url(url):
                raise AppError("URL is invalid or resolves to a blocked private network address (SSRF protection).", status_code=400)
            try:
                async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                    resp = await client.get(url, headers={"User-Agent": "JobMailBot/1.0"})
                    if resp.status_code != 200:
                        raise AppError(f"Failed to fetch job posting from URL: HTTP {resp.status_code}", status_code=400)
                    if len(resp.content) > 2 * 1024 * 1024:
                        raise AppError("Job description page exceeds maximum allowable size (2MB)", status_code=400)
                    html = resp.text
                    # Strip script/style tags and html markup
                    cleaned = re.sub(r"<(script|style).*?</\1>", " ", html, flags=re.DOTALL | re.IGNORECASE)
                    jd_content = re.sub(r"<[^>]+>", " ", cleaned)
                    jd_content = re.sub(r"\s+", " ", jd_content).strip()[:8000]
            except AppError:
                raise
            except Exception as e:
                log.warning("fetch_jd_url_error", url=url, error=str(e))
                raise AppError(f"Unable to read job description URL: {str(e)}", status_code=400)

        if not jd_content.strip():
            raise AppError("Please provide job description text or a valid URL", status_code=400)

        prompt = f"Analyze the following job description and extract the exact details:\n\n{jd_content}"
        system_instruction = (
            "You are an expert recruiter assistant. Extract the job title/role, hiring company name, "
            "contact or hiring manager name (if any), job location, and required technical/professional skills. "
            "Never invent facts not present in the text."
        )

        try:
            return await LLMRouter.generate_with_fallback(
                tenant_id=tenant_id,
                prompt=prompt,
                response_schema=ExtractJdResponse,
                system_instruction=system_instruction
            )
        except Exception as e:
            log.warning("llm_extraction_failed_fallback_regex", error=str(e))
            # Resilient fallback extraction using regex + keyword matching
            matched_skills = [s.title() for s in KNOWN_SKILLS if s in jd_content.lower()]
            m_role = re.search(r"(?:hiring|looking for|role|position|job title)[:\s]+(?:an?\s+)?([A-Z][\w+/ .-]{2,40})", jd_content, re.IGNORECASE)
            m_co = re.search(r"(?:company|at)[:\s]+([A-Z][\w&. -]{1,30})", jd_content)
            m_hr = re.search(r"(?:contact|recruiter|hr)[:\s]+([A-Z][a-z]+(?: [A-Z][a-z]+)?)", jd_content)
            m_loc = re.search(r"location[:\s]+([\w, ]{2,40})", jd_content, re.IGNORECASE)

            role = m_role.group(1).strip() if m_role else jd_content.split("\n")[0][:40]
            company = m_co.group(1).strip() if m_co else "Company"
            hr = m_hr.group(1).strip() if m_hr else ""
            location = m_loc.group(1).strip() if m_loc else ""

            return ExtractJdResponse(
                role=role,
                company=company,
                hr=hr,
                location=location,
                skills=matched_skills[:8]
            )
