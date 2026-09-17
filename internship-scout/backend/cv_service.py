"""CV handling: extract → structure → improve → ATS rewrite → render PDF."""

from __future__ import annotations

import io
import re
from typing import Any

from docx import Document as DocxDocument
from pypdf import PdfReader
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

from llm import complete_json

MAX_CV_CHARS = 20000

# The ATS template every generated CV follows. It is the single source of truth
# for both the LLM prompt and the PDF renderer.
CV_JSON_SHAPE = """{
  "contact": {"name": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "", "website": ""},
  "summary": "2-3 sentence professional summary, specific, no buzzwords",
  "skills": [{"category": "Languages", "items": ["Python", "TypeScript"]}],
  "experience": [
    {"title": "", "company": "", "location": "", "start": "Mon YYYY", "end": "Mon YYYY or Present",
     "bullets": ["Action verb + what + measurable result"]}
  ],
  "projects": [
    {"name": "", "tech": ["..."], "link": "", "bullets": ["Action verb + what + impact"]}
  ],
  "education": [
    {"degree": "", "institution": "", "location": "", "start": "", "end": "", "details": "GPA / relevant coursework / honours, optional"}
  ],
  "certifications": ["optional, short strings"],
  "achievements": ["optional, short strings"]
}"""

ATS_RULES = """ATS rules (mandatory):
- Single page worth of content: aim for 350-550 words total.
- Sections in this order: Contact, Summary, Skills, Experience, Projects, Education. Certifications/Achievements only if present.
- Every bullet starts with a strong past-tense action verb (Built, Led, Reduced, Automated, Designed...).
- Quantify wherever the source material allows (%, counts, time saved, users). Never invent numbers.
- No tables, no columns, no graphics, no icons, no pronouns, no fluff adjectives.
- Keep the candidate's real facts. Do not fabricate employers, degrees, dates, or tools.
- For students with no experience, lean on projects, coursework, and leadership; leave experience as an empty array rather than inventing it."""


# ----------------------------------------------------------------------------
# Extraction
# ----------------------------------------------------------------------------

def extract_text(filename: str, data: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages)
    elif name.endswith(".docx"):
        doc = DocxDocument(io.BytesIO(data))
        parts = [p.text for p in doc.paragraphs]
        for table in doc.tables:
            for row in table.rows:
                parts.append(" | ".join(cell.text for cell in row.cells))
        text = "\n".join(parts)
    else:
        raise ValueError("Only PDF and DOCX files are supported.")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 80:
        raise ValueError("We couldn't read any text from that file. If it's a scanned image, export it as a text PDF first.")
    return text[:MAX_CV_CHARS]


# ----------------------------------------------------------------------------
# Structure + review an uploaded CV
# ----------------------------------------------------------------------------

PARSE_CV_SYSTEM = f"""You are an expert technical recruiter and CV reviewer.

Read the raw text of a candidate's CV and return ONLY a valid JSON object (no fences, no preamble):
{{
  "cv": {CV_JSON_SHAPE},
  "review": {{
    "overall_score": 0-100 integer for how well this CV would perform with recruiters and ATS,
    "ats_score": 0-100 integer for machine-readability and keyword coverage,
    "strengths": ["2-4 specific strengths"],
    "improvements": [
      {{"section": "Summary|Skills|Experience|Projects|Education|Formatting|Contact",
        "issue": "what is weak, specific",
        "fix": "concrete rewrite advice",
        "priority": "high|medium|low"}}
    ],
    "missing_keywords": ["skills/keywords a recruiter for this candidate's target roles would expect"],
    "target_roles": ["2-4 role titles this CV is currently best positioned for"]
  }},
  "context_summary": "4-6 sentence plain-English description of this person: education stage, skills, experience level, notable projects, and likely role targets. Written in first person as if the candidate typed it."
}}

Preserve the candidate's real facts exactly. Do not invent anything. Empty arrays where sections are absent."""


def structure_uploaded_cv(text: str, user_id: str) -> dict:
    result = complete_json(system=PARSE_CV_SYSTEM, user=f"CV text:\n\n{text}", max_tokens=6000, action="cv_parse", user_id=user_id)
    if not isinstance(result, dict) or "cv" not in result:
        raise ValueError("Claude returned an unexpected shape while reading the CV.")
    return result


# ----------------------------------------------------------------------------
# ATS rewrite of an existing CV (Pro)
# ----------------------------------------------------------------------------

ATS_REWRITE_SYSTEM = f"""You are an expert CV writer who specialises in ATS-optimised single-page CVs.

Rewrite the candidate's structured CV into a stronger version following the template and rules below.
Return ONLY a valid JSON object of this exact shape (no fences, no preamble):
{CV_JSON_SHAPE}

{ATS_RULES}
- If a target role is provided, prioritise its keywords naturally across summary, skills, and bullets."""


def ats_rewrite(cv: dict, target_role: str | None, user_id: str) -> dict:
    user = f"Target role: {target_role or 'not specified — optimise for the roles this CV already targets'}\n\nStructured CV JSON:\n{cv}"
    result = complete_json(system=ATS_REWRITE_SYSTEM, user=user, max_tokens=6000, action="cv_ats_rewrite", user_id=user_id)
    if not isinstance(result, dict):
        raise ValueError("Claude returned an unexpected shape for the rewrite.")
    return result


# ----------------------------------------------------------------------------
# Generate a CV from the wizard form
# ----------------------------------------------------------------------------

GENERATE_SYSTEM = f"""You are an expert CV writer who specialises in ATS-optimised single-page CVs for students and early-career professionals.

The candidate filled in a form. Turn it into a polished CV.
Return ONLY a valid JSON object of this exact shape (no fences, no preamble):
{CV_JSON_SHAPE}

{ATS_RULES}
- Rewrite the candidate's rough notes into crisp bullets; keep every fact, improve every sentence.
- If the form is thin (e.g. a 2nd-semester student), keep it honest: strong summary, skills, projects, education. Never pad."""


def generate_cv(form: dict, user_id: str) -> dict:
    result = complete_json(system=GENERATE_SYSTEM, user=f"Form data:\n{form}", max_tokens=6000, action="cv_generate", user_id=user_id)
    if not isinstance(result, dict):
        raise ValueError("Claude returned an unexpected shape for the CV.")
    return result


# ----------------------------------------------------------------------------
# PDF rendering (ATS-safe: single column, real text, standard fonts)
# ----------------------------------------------------------------------------

def _esc(value: Any) -> str:
    text = "" if value is None else str(value)
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_cv_pdf(cv: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"{(cv.get('contact') or {}).get('name', 'CV')} - CV",
        author=(cv.get("contact") or {}).get("name", ""),
    )
    styles = getSampleStyleSheet()
    name_style = ParagraphStyle("name", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=18, leading=22, alignment=TA_LEFT, spaceAfter=2)
    contact_style = ParagraphStyle("contact", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=12, textColor="#333333", spaceAfter=6)
    h_style = ParagraphStyle("h", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=10.5, leading=13, spaceBefore=8, spaceAfter=3, textColor="#111111")
    body = ParagraphStyle("body", parent=styles["Normal"], fontName="Helvetica", fontSize=9.5, leading=12.5)
    small = ParagraphStyle("small", parent=body, fontSize=9, leading=11.5, textColor="#333333")
    bullet = ParagraphStyle("bullet", parent=body, leftIndent=0)

    story: list[Any] = []
    contact = cv.get("contact") or {}
    story.append(Paragraph(_esc(contact.get("name") or "Your Name"), name_style))
    contact_bits = [contact.get(k) for k in ("email", "phone", "location", "linkedin", "github", "website") if contact.get(k)]
    if contact_bits:
        story.append(Paragraph(" &nbsp;|&nbsp; ".join(_esc(b) for b in contact_bits), contact_style))

    def heading(title: str):
        story.append(Paragraph(title.upper(), h_style))

    def bullets(items: list[str]):
        if not items:
            return
        flow = ListFlowable(
            [ListItem(Paragraph(_esc(b), bullet), leftIndent=10) for b in items if b],
            bulletType="bullet",
            start="•",
            leftIndent=10,
            bulletFontSize=8,
        )
        story.append(flow)

    if cv.get("summary"):
        heading("Summary")
        story.append(Paragraph(_esc(cv["summary"]), body))

    skills = cv.get("skills") or []
    if skills:
        heading("Skills")
        for group in skills:
            if isinstance(group, dict):
                items = ", ".join(_esc(i) for i in (group.get("items") or []))
                story.append(Paragraph(f"<b>{_esc(group.get('category') or 'Skills')}:</b> {items}", body))
            else:
                story.append(Paragraph(_esc(group), body))

    experience = cv.get("experience") or []
    if experience:
        heading("Experience")
        for exp in experience:
            dates = " – ".join(x for x in [exp.get("start"), exp.get("end")] if x)
            story.append(Paragraph(f"<b>{_esc(exp.get('title'))}</b> — {_esc(exp.get('company'))}"
                                   + (f", {_esc(exp.get('location'))}" if exp.get("location") else "")
                                   + (f" &nbsp;<font color='#555555'>({_esc(dates)})</font>" if dates else ""), body))
            bullets(exp.get("bullets") or [])
            story.append(Spacer(1, 3))

    projects = cv.get("projects") or []
    if projects:
        heading("Projects")
        for proj in projects:
            tech = ", ".join(_esc(t) for t in (proj.get("tech") or []))
            line = f"<b>{_esc(proj.get('name'))}</b>"
            if tech:
                line += f" — {tech}"
            if proj.get("link"):
                line += f" &nbsp;<font color='#555555'>{_esc(proj['link'])}</font>"
            story.append(Paragraph(line, body))
            bullets(proj.get("bullets") or [])
            story.append(Spacer(1, 3))

    education = cv.get("education") or []
    if education:
        heading("Education")
        for edu in education:
            dates = " – ".join(x for x in [edu.get("start"), edu.get("end")] if x)
            story.append(Paragraph(f"<b>{_esc(edu.get('degree'))}</b> — {_esc(edu.get('institution'))}"
                                   + (f", {_esc(edu.get('location'))}" if edu.get("location") else "")
                                   + (f" &nbsp;<font color='#555555'>({_esc(dates)})</font>" if dates else ""), body))
            if edu.get("details"):
                story.append(Paragraph(_esc(edu["details"]), small))

    certs = cv.get("certifications") or []
    if certs:
        heading("Certifications")
        bullets(certs)

    achievements = cv.get("achievements") or []
    if achievements:
        heading("Achievements")
        bullets(achievements)

    doc.build(story)
    return buffer.getvalue()
