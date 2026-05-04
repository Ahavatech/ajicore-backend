from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pdfs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

PDF_PATH = OUTPUT_DIR / "ajicore-frontend-backend-handoff.pdf"


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="TitleLarge",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.3,
            leading=14.2,
            textColor=colors.HexColor("#334155"),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13.5,
            leading=16,
            textColor=colors.HexColor("#0F172A"),
            spaceBefore=10,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Subsection",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11.2,
            leading=13.2,
            textColor=colors.HexColor("#1D4ED8"),
            spaceBefore=8,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CodeBlock",
            parent=styles["Code"],
            fontName="Courier",
            fontSize=8.3,
            leading=11,
            leftIndent=8,
            rightIndent=8,
            textColor=colors.HexColor("#0F172A"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="SmallMuted",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.8,
            leading=11.5,
            textColor=colors.HexColor("#64748B"),
        )
    )
    return styles


def bullet_list(items, style):
    return ListFlowable(
        [ListItem(Paragraph(item, style), leftIndent=8) for item in items],
        bulletType="bullet",
        start="circle",
        bulletColor=colors.HexColor("#1D4ED8"),
        leftIndent=14,
        spaceBefore=4,
        spaceAfter=8,
    )


def code_block(text, styles):
    rows = [[Paragraph(line.replace(" ", "&nbsp;"), styles["CodeBlock"])] for line in text.strip().splitlines()]
    table = Table(rows, colWidths=[170 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def section_header(title, styles):
    return Paragraph(title, styles["Section"])


def subsection(title, styles):
    return Paragraph(title, styles["Subsection"])


def page_frame(canvas, doc):
    canvas.saveState()
    width, height = A4

    canvas.setFillColor(colors.HexColor("#0F172A"))
    canvas.rect(0, height - 26 * mm, width, 26 * mm, stroke=0, fill=1)

    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 15)
    canvas.drawString(18 * mm, height - 16 * mm, "Ajicore Backend Handoff")

    canvas.setFont("Helvetica", 8.8)
    canvas.drawRightString(width - 18 * mm, height - 16 * mm, "Frontend Integration Update")

    canvas.setStrokeColor(colors.HexColor("#E2E8F0"))
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)

    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 9 * mm, "Prepared for frontend handoff")
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_story():
    styles = build_styles()
    story = []

    story.append(Spacer(1, 14 * mm))
    story.append(Paragraph("Ajicore Backend Update Handoff", styles["TitleLarge"]))
    story.append(
        Paragraph(
            "Hi team, I completed a backend contract pass for the requested frontend integrations "
            "and fixed the main payload and response mismatches in the affected modules. "
            "This document summarizes what is now supported and highlights a few implementation "
            "notes that should make the frontend wiring straightforward.",
            styles["Body"],
        )
    )

    story.append(section_header("1. Twilio Onboarding", styles))
    story.append(subsection("Available numbers", styles))
    story.append(Paragraph("Endpoint: GET /api/auth/onboarding/available-numbers", styles["Body"]))
    story.append(
        bullet_list(
            [
                "Supported query patterns: city search with type=city and city=Atlanta, and area-code search with type=area_code and area_code=404",
                "City lookup now uses Twilio locality search correctly",
                "Response shape is trimmed to the exact frontend fields",
            ],
            styles["Body"],
        )
    )
    story.append(
        code_block(
            """
{
  "type": "city",
  "country": "US",
  "count": 2,
  "numbers": [
    {
      "phone_number": "+14045551234",
      "friendly_name": "(404) 555-1234",
      "locality": "Atlanta",
      "region": "GA",
      "capabilities": {
        "voice": true,
        "sms": true,
        "mms": false
      }
    }
  ]
}
            """,
            styles,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(subsection("Step 3 provisioning", styles))
    story.append(Paragraph("Endpoint: POST /api/auth/onboarding/step3", styles["Body"]))
    story.append(
        code_block(
            """
{
  "phone_number": "+14045551234",
  "search_type": "city"
}
            """,
            styles,
        )
    )
    story.append(
        bullet_list(
            [
                "The backend provisions the number through Twilio",
                "Twilio SID is stored on the business record",
                "The AI phone number is attached to the business record",
            ],
            styles["Body"],
        )
    )
    story.append(subsection("Step 5 logo", styles))
    story.append(Paragraph("Endpoint: POST /api/auth/onboarding/step5", styles["Body"]))
    story.append(
        code_block(
            """
{
  "logo_url": "https://storage.myajicore.com/uploads/logo-final.png"
}
            """,
            styles,
        )
    )
    story.append(Paragraph("Important: this endpoint expects only logo_url and does not handle file upload directly.", styles["Body"]))

    story.append(section_header("2. Customers", styles))
    story.append(Paragraph("Endpoints: POST /api/customers and PATCH /api/customers/:id", styles["Body"]))
    story.append(
        bullet_list(
            [
                "If customer_type is Individual, first_name is required",
                "If customer_type is Company, company_name is required",
                "Optional text fields can be empty or null without triggering the wrong validation path",
                "Customer list now responds in the frontend-friendly form: { \"data\": [...] }",
            ],
            styles["Body"],
        )
    )

    story.append(section_header("3. Quotes vs Estimate Appointments", styles))
    story.append(Paragraph("Endpoints: POST /api/quotes and PATCH /api/quotes/:id", styles["Body"]))
    story.append(subsection("Estimate Appointment mode", styles))
    story.append(
        bullet_list(
            [
                "Use line_items: []",
                "Set is_estimate_appointment: true",
                "Set status: \"Appointment\"",
                "Provide assigned_staff_id, scheduled_estimate_date, and scheduled_estimate_time",
                "scheduled_estimate_time must be in 24-hour HH:MM format, for example 14:30",
            ],
            styles["Body"],
        )
    )
    story.append(
        code_block(
            """
{
  "business_id": "uuid-1234",
  "customer_id": "uuid-cust-5678",
  "assigned_staff_id": "uuid-staff-999",
  "service_name": "Kitchen Sink Inspection",
  "service_category": "Plumbing",
  "custom_category_name": null,
  "contract_type": { "warranty": false, "recurring": false, "oneTime": true },
  "warranty_due": null,
  "description": "Customer called regarding a leak under the sink. Needs inspection.",
  "photos": ["https://storage.myajicore.com/uploads/photo1.jpg"],
  "line_items": [],
  "manual_subtotal": 0,
  "discount_percent": 0,
  "tax_percent": 0,
  "deposit_percent": 0,
  "total_amount": 0,
  "deposit_amount": 0,
  "payment_due_terms": "Upon receipt",
  "scheduled_estimate_date": "2026-05-15T00:00:00.000Z",
  "scheduled_estimate_time": "14:30",
  "notes": "Tech should park in the driveway.",
  "status": "Appointment",
  "is_estimate_appointment": true
}
            """,
            styles,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(subsection("Quote mode", styles))
    story.append(
        bullet_list(
            [
                "Use populated line_items",
                "Set is_estimate_appointment: false",
                "assigned_staff_id can be null",
                "scheduled_estimate_date and scheduled_estimate_time can be null",
                "quantity is not required in line items",
            ],
            styles["Body"],
        )
    )

    story.append(PageBreak())

    story.append(section_header("4. Price Book", styles))
    story.append(Paragraph("Endpoints: POST /api/price-book, PATCH /api/price-book/:id, GET /api/price-book", styles["Body"]))
    story.append(
        bullet_list(
            [
                "A compatibility alias also exists for PATCH /api/price-book when id is sent in the body",
                "GET now returns the exact shape { \"data\": [...] }",
                "materials, tools, visit_type, service_cost, service_call_fee, labor_time, labor_cost, and pricing metrics are preserved",
                "margin_percent is returned as a decimal when appropriate",
            ],
            styles["Body"],
        )
    )

    story.append(section_header("5. Jobs", styles))
    story.append(Paragraph("Endpoints: POST /api/jobs and PATCH /api/jobs/:id", styles["Body"]))
    story.append(
        bullet_list(
            [
                "The backend now accepts estimated_time",
                "photo_urls and rich line-item snapshots are supported",
                "Job responses now include customer_address, estimated_time, and scheduled_end_time",
            ],
            styles["Body"],
        )
    )

    story.append(section_header("6. AI Call Center Dashboard", styles))
    story.append(Paragraph("New and updated endpoints are ready for the dashboard module.", styles["Body"]))
    story.append(
        bullet_list(
            [
                "GET /api/businesses/:business_id returns { data: { id, name, ai_phone_number } }",
                "GET /api/ai-logs?business_id={id} returns { data: [...] }",
                "GET /api/ai-logs/:log_id returns a single log object",
                "GET /api/ai/status?business_id={id} returns { status: \"active\" }",
                "POST /api/ai/toggle-status accepts { business_id, status } where status is active or paused",
            ],
            styles["Body"],
        )
    )

    story.append(section_header("7. Swagger and API Docs", styles))
    story.append(
        Paragraph(
            "Swagger has been updated to reflect these changes across Twilio onboarding, customer validation, "
            "jobs payloads, price book payloads and AI dashboard endpoints.",
            styles["Body"],
        )
    )

    story.append(section_header("8. Important Frontend Notes", styles))
    story.append(
        bullet_list(
            [
                "Estimate appointments must use line_items: [] with is_estimate_appointment: true and status: \"Appointment\"",
                "scheduled_estimate_time must be HH:MM in 24-hour format",
                "Company customers should not be sent with forced first_name and last_name assumptions",
                "Price book list responses and AI log list responses now come back in { \"data\": [...] } form",
                "Jobs accept full line-item snapshot objects, so the frontend can send richer service snapshots directly",
            ],
            styles["Body"],
        )
    )

    story.append(section_header("9. Fastest Way to Debug Anything Remaining", styles))
    story.append(
        Paragraph(
            "If any frontend flow still fails, the quickest way to isolate it is to send the exact endpoint, "
            "request payload, response status, and response body. That makes it easy to tell whether the issue "
            "is a backend contract bug or a mapping mismatch on the frontend side.",
            styles["Body"],
        )
    )
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Prepared by backend for frontend handoff.", styles["SmallMuted"]))

    return story


def build_pdf():
    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=34 * mm,
        bottomMargin=20 * mm,
        title="Ajicore Backend Update Handoff",
        author="Codex",
    )
    doc.build(build_story(), onFirstPage=page_frame, onLaterPages=page_frame)


if __name__ == "__main__":
    build_pdf()
    print(PDF_PATH)
