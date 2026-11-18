"""Resume export service generating clean PDF and DOCX templates."""
import io
import json
from typing import Any, Dict
from docx import Document as DocxDocument
from docx.shared import Inches, Pt, RGBColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from app.models.profile import Profile
from app.models.resume import ResumeVersion


class ResumeExportService:
    @staticmethod
    def export_pdf(profile: Profile, resume_version: ResumeVersion) -> bytes:
        """Export resume to clean PDF bytes."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40
        )
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=RGBColor(30, 41, 59)
        )
        subtitle_style = ParagraphStyle(
            "Subtitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=14,
            textColor=RGBColor(100, 116, 139)
        )
        heading_style = ParagraphStyle(
            "SectionHeading",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=RGBColor(79, 70, 229),
            spaceAfter=4
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=RGBColor(51, 65, 85)
        )
        bullet_style = ParagraphStyle(
            "Bullet",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            leftIndent=15,
            textColor=RGBColor(51, 65, 85)
        )

        elements = []
        # Header
        elements.append(Paragraph(profile.name or "Candidate", title_style))
        elements.append(Paragraph(f"{profile.headline} • {profile.email} • {profile.links}", subtitle_style))
        elements.append(Spacer(1, 12))

        # Skills
        elements.append(Paragraph("SKILLS", heading_style))
        elements.append(Paragraph(", ".join(profile.skills), body_style))
        elements.append(Spacer(1, 10))

        # Parse tailored data or fallback to master profile
        tailored_data = {}
        try:
            tailored_data = json.loads(resume_version.text)
        except Exception:
            pass

        exp_list = tailored_data.get("experience", profile.experience)
        proj_list = tailored_data.get("projects", profile.projects)

        # Experience
        if exp_list:
            elements.append(Paragraph("PROFESSIONAL EXPERIENCE", heading_style))
            for item in exp_list:
                company = item.get("company", "")
                role = item.get("role", "")
                period = item.get("period", "")
                header_line = f"<b>{role}</b> at <b>{company}</b> ({period})"
                elements.append(Paragraph(header_line, body_style))
                for b in item.get("bullets", []):
                    elements.append(Paragraph(f"• {b}", bullet_style))
                elements.append(Spacer(1, 6))

        # Projects
        if proj_list:
            elements.append(Paragraph("PROJECTS", heading_style))
            for item in proj_list:
                name = item.get("company", "")
                role = item.get("role", "")
                period = item.get("period", "")
                header_line = f"<b>{name}</b> – {role} ({period})"
                elements.append(Paragraph(header_line, body_style))
                for b in item.get("bullets", []):
                    elements.append(Paragraph(f"• {b}", bullet_style))
                elements.append(Spacer(1, 6))

        # Education
        if profile.education:
            elements.append(Paragraph("EDUCATION", heading_style))
            elements.append(Paragraph(profile.education, body_style))

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def export_docx(profile: Profile, resume_version: ResumeVersion) -> bytes:
        """Export resume to styled DOCX document bytes."""
        doc = DocxDocument()

        # Set title
        title = doc.add_heading(profile.name or "Candidate", level=0)
        p_sub = doc.add_paragraph(f"{profile.headline} | {profile.email} | {profile.links}")
        p_sub.style.font.size = Pt(10)
        p_sub.style.font.color.rgb = RGBColor(100, 116, 139)

        # Skills
        doc.add_heading("Technical Skills", level=1)
        doc.add_paragraph(", ".join(profile.skills))

        tailored_data = {}
        try:
            tailored_data = json.loads(resume_version.text)
        except Exception:
            pass

        exp_list = tailored_data.get("experience", profile.experience)
        proj_list = tailored_data.get("projects", profile.projects)

        # Experience
        if exp_list:
            doc.add_heading("Experience", level=1)
            for item in exp_list:
                p_item = doc.add_paragraph()
                r_role = p_item.add_run(f"{item.get('role', '')} ")
                r_role.bold = True
                p_item.add_run(f"— {item.get('company', '')} ({item.get('period', '')})")
                for bullet in item.get("bullets", []):
                    doc.add_paragraph(bullet, style="List Bullet")

        # Projects
        if proj_list:
            doc.add_heading("Projects", level=1)
            for item in proj_list:
                p_item = doc.add_paragraph()
                r_name = p_item.add_run(f"{item.get('company', '')} ")
                r_name.bold = True
                p_item.add_run(f"— {item.get('role', '')} ({item.get('period', '')})")
                for bullet in item.get("bullets", []):
                    doc.add_paragraph(bullet, style="List Bullet")

        if profile.education:
            doc.add_heading("Education", level=1)
            doc.add_paragraph(profile.education)

        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()
