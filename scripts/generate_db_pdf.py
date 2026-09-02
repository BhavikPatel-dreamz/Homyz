import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

pdf_filename = "/media/drive/shihab/Homyz/Homyz_Database_Structure.pdf"

doc = SimpleDocTemplate(
    pdf_filename,
    pagesize=letter,
    rightMargin=36,
    leftMargin=36,
    topMargin=36,
    bottomMargin=36
)

styles = getSampleStyleSheet()

# Custom styles
title_style = ParagraphStyle(
    "DocTitle",
    parent=styles["Heading1"],
    fontName="Helvetica-Bold",
    fontSize=22,
    leading=26,
    textColor=colors.HexColor("#0F172A"),
    spaceAfter=6
)

subtitle_style = ParagraphStyle(
    "DocSubtitle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=10,
    leading=14,
    textColor=colors.HexColor("#64748B"),
    spaceAfter=15
)

section_title = ParagraphStyle(
    "SectionTitle",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=14,
    leading=18,
    textColor=colors.HexColor("#1E293B"),
    spaceBefore=14,
    spaceAfter=8
)

model_title = ParagraphStyle(
    "ModelTitle",
    parent=styles["Heading3"],
    fontName="Helvetica-Bold",
    fontSize=11,
    leading=14,
    textColor=colors.HexColor("#0F172A"),
    spaceBefore=10,
    spaceAfter=4
)

body_style = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8,
    leading=11,
    textColor=colors.HexColor("#334155")
)

code_style = ParagraphStyle(
    "Code",
    parent=styles["Normal"],
    fontName="Courier-Bold",
    fontSize=7.5,
    leading=10,
    textColor=colors.HexColor("#0F172A")
)

enum_style = ParagraphStyle(
    "EnumVal",
    parent=styles["Normal"],
    fontName="Courier",
    fontSize=7.5,
    leading=10,
    textColor=colors.HexColor("#D97706")
)

story = []

# Title Banner
story.append(Paragraph("Homyz Platform — Database Structure & Schema Reference", title_style))
story.append(Paragraph("Engine: PostgreSQL | ORM: Prisma 7 | Generated Architecture Document", subtitle_style))
story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#F59E0B"), spaceAfter=15))

# Overview Table
overview_data = [
    [Paragraph("<b>Component</b>", body_style), Paragraph("<b>Specification / Details</b>", body_style)],
    [Paragraph("<b>Database Provider</b>", body_style), Paragraph("PostgreSQL (Hosted via Prisma Client Generator)", body_style)],
    [Paragraph("<b>ORM Framework</b>", body_style), Paragraph("Prisma 7 (Output: generated/prisma)", body_style)],
    [Paragraph("<b>Primary Domain Models</b>", body_style), Paragraph("User, Listing, Booking, HostRegistrationRequest, HostComplianceCheck, AuditLog", body_style)],
    [Paragraph("<b>Security & RBAC</b>", body_style), Paragraph("AdminRole, AdminPermission, AdminRolePermission, HostPermissionOverride, AdminPermissionOverride", body_style)],
    [Paragraph("<b>Auth & Identity</b>", body_style), Paragraph("Account, Session, VerificationToken, OtpCode, PasswordResetToken, RefreshToken", body_style)]
]
t_overview = Table(overview_data, colWidths=[150, 390])
t_overview.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (1, 0), colors.HexColor("#FEF3C7")),
    ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor("#0F172A")),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
    ('PADDING', (0, 0), (-1, -1), 5),
]))
story.append(t_overview)
story.append(Spacer(1, 15))

# 1. ENUMS SECTION
story.append(Paragraph("1. System Enumerations (Enums)", section_title))

enums_list = [
    ("Role", "ADMIN, HOST, USER"),
    ("UserStatus", "ACTIVE, SUSPENDED, INVITATION_PENDING"),
    ("BookingStatus", "PENDING, CONFIRMED, CANCELLED"),
    ("ListingStatus", "DRAFT, IN_PROGRESS, PENDING_REVIEW, CHANGES_REQUESTED, APPROVED, REJECTED, ACTIVE"),
    ("HostingType", "HOME, EXPERIENCE, SERVICE"),
    ("HostRegistrationStatus", "PENDING, IN_REVIEW, WAITING_FOR_DOCUMENTS, DOCUMENTS_UNDER_REVIEW, APPROVED, REJECTED"),
    ("HostDocumentStatus", "PENDING, VERIFIED, REJECTED, EXPIRED"),
    ("HostComplianceStatus", "PENDING, UNDER_REVIEW, ACTION_REQUIRED, COMPLIANT, NON_COMPLIANT"),
    ("ComplianceCheckStatus", "PENDING, PASSED, FAILED"),
    ("ComplianceIssueSeverity", "LOW, MEDIUM, HIGH, CRITICAL"),
    ("ComplianceIssueStatus", "OPEN, UNDER_REVIEW, RESOLVED, REJECTED"),
    ("AdminInvitationStatus", "PENDING, ACCEPTED, EXPIRED, REVOKED, FAILED"),
    ("OtpChannel", "SMS, EMAIL"),
    ("OtpPurpose", "PHONE_VERIFICATION, LOGIN, PASSWORD_RESET")
]

enum_table_data = [[Paragraph("<b>Enum Name</b>", body_style), Paragraph("<b>Values</b>", body_style)]]
for name, vals in enums_list:
    enum_table_data.append([
        Paragraph(f"<b>{name}</b>", code_style),
        Paragraph(vals, enum_style)
    ])

t_enum = Table(enum_table_data, colWidths=[140, 400])
t_enum.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
    ('PADDING', (0, 0), (-1, -1), 4),
]))
story.append(t_enum)
story.append(Spacer(1, 15))

# 2. CORE DOMAIN MODELS
story.append(Paragraph("2. Database Models & Schema Specifications", section_title))

models_schema = [
    {
        "name": "User",
        "desc": "Primary user account (Host, Admin, or Guest traveler). Manages identity, authentication credentials, permissions, and relations.",
        "fields": [
            ("id", "String (CUID)", "Primary key"),
            ("name, email, phone", "String", "Contact identity fields (@unique email & phone)"),
            ("role", "Role (Enum)", "ADMIN | HOST | USER (default: USER)"),
            ("status", "UserStatus (Enum)", "ACTIVE | SUSPENDED | INVITATION_PENDING"),
            ("passwordHash", "String", "Hashed authentication password"),
            ("adminRoleId", "String (FK)", "Reference to AdminRole table"),
            ("createdAt, updatedAt", "DateTime", "Timestamps")
        ]
    },
    {
        "name": "Listing",
        "desc": "Host property listing. Contains multi-step onboarding data, location, pricing, rules, photos, discounts, and approval state.",
        "fields": [
            ("id", "String (CUID)", "Primary key"),
            ("hostId", "String (FK)", "Host User relation (User.id)"),
            ("title, description", "String / Text", "Listing name and full text overview"),
            ("price", "Int", "Nightly base price in minor currency units (cents)"),
            ("status", "ListingStatus (Enum)", "DRAFT | PENDING_REVIEW | APPROVED | REJECTED | ACTIVE"),
            ("hostingType, listingType, propertyType", "String", "Property categorizations (e.g., Home, Apartment, Entire place)"),
            ("address, city, district, country", "String", "Property location details & coordinates"),
            ("guests, bedrooms, beds, bathrooms", "Int", "Capacity & room counts"),
            ("photos, amenities, houseRules", "String[]", "Media URLs array, amenity tags, house rules"),
            ("weekendPrice, discounts", "Int / Json", "Custom weekend rates & weekly/monthly discount settings"),
            ("checkInMethod, checkInStart, checkInEnd", "String", "Smart lock, keypad entry, and check-in window times")
        ]
    },
    {
        "name": "Booking",
        "desc": "Reservation record between a Guest (User) and a Host Property (Listing).",
        "fields": [
            ("id", "String (CUID)", "Primary key"),
            ("userId", "String (FK)", "Guest User relation"),
            ("listingId", "String (FK)", "Reserved Listing relation"),
            ("status", "BookingStatus (Enum)", "PENDING | CONFIRMED | CANCELLED"),
            ("startDate, endDate", "DateTime", "Reservation check-in and check-out dates")
        ]
    },
    {
        "name": "HostRegistrationRequest",
        "desc": "Host onboarding application & lifecycle management record (intake, document reviews, compliance checks).",
        "fields": [
            ("id, applicationId", "String (CUID)", "Unique request and application identifiers"),
            ("applicantName, applicantEmail, applicantPhone", "String", "Host applicant contact details"),
            ("status", "HostRegistrationStatus (Enum)", "PENDING | IN_REVIEW | DOCUMENTS_UNDER_REVIEW | APPROVED | REJECTED"),
            ("complianceStatus", "HostComplianceStatus (Enum)", "PENDING | UNDER_REVIEW | COMPLIANT | NON_COMPLIANT"),
            ("assignedReviewerId", "String (FK)", "Assigned Admin reviewer User relation"),
            ("hostId", "String (FK)", "Linked User account upon approval")
        ]
    },
    {
        "name": "HostRegistrationDocument",
        "desc": "Uploaded verification documents (Government ID, Proof of Address, Business License, Property Deed).",
        "fields": [
            ("id", "String (CUID)", "Primary key"),
            ("requestId", "String (FK)", "Relation to HostRegistrationRequest"),
            ("documentType", "String", "GOVERNMENT_ID | PROOF_OF_ADDRESS | BUSINESS_LICENSE | PROPERTY_DEED"),
            ("fileName, fileUrl, mimeType, fileSize", "String / Int", "Uploaded file metadata & storage URL"),
            ("status", "HostDocumentStatus (Enum)", "PENDING | VERIFIED | REJECTED | EXPIRED"),
            ("expiryDate", "DateTime", "Document expiration date")
        ]
    },
    {
        "name": "HostComplianceCheck & HostComplianceIssue",
        "desc": "Verification checks (Identity, Address, Docs) and flagged compliance issues (Address Mismatch, Sanctions).",
        "fields": [
            ("checkKey, checkName", "String", "Check type identifier (e.g., IDENTITY_VERIFIED)"),
            ("status", "ComplianceCheckStatus / ComplianceIssueStatus", "PASSED | FAILED / OPEN | UNDER_REVIEW | RESOLVED"),
            ("severity", "ComplianceIssueSeverity (Enum)", "LOW | MEDIUM | HIGH | CRITICAL")
        ]
    },
    {
        "name": "AdminRole, AdminPermission, AdminRolePermission",
        "desc": "Role-Based Access Control (RBAC) matrix defining permissions for Admin Panel users.",
        "fields": [
            ("name, slug", "String", "Role identifier (e.g. Super Admin, Support Agent)"),
            ("module, action", "String", "Permission scope (e.g. module: HOSTS, action: READ)")
        ]
    },
    {
        "name": "HostPermissionOverride & AdminPermissionOverride",
        "desc": "Fine-grained individual permission overrides for specific Hosts or Admins.",
        "fields": [
            ("hostId / adminId", "String (FK)", "Target User relation"),
            ("permission", "String", "Permission key string"),
            ("effect", "String", "ALLOW or DENY")
        ]
    },
    {
        "name": "AuditLog",
        "desc": "Comprehensive security and operational audit trail for all administrative and system actions.",
        "fields": [
            ("actorId, actorEmail", "String", "User performing the action"),
            ("action, resourceType, resourceId", "String", "Action performed (e.g. UPDATE_LISTING, APPROVE_HOST)"),
            ("status, ip, userAgent, metadata", "String / Json", "Execution result, client IP, metadata JSON payload")
        ]
    }
]

for model in models_schema:
    story.append(Paragraph(f"Model: {model['name']}", model_title))
    story.append(Paragraph(model['desc'], body_style))
    story.append(Spacer(1, 3))

    table_data = [[Paragraph("<b>Field / Column</b>", body_style), Paragraph("<b>Data Type</b>", body_style), Paragraph("<b>Description & Rules</b>", body_style)]]
    for field, ftype, fdesc in model['fields']:
        table_data.append([
            Paragraph(field, code_style),
            Paragraph(ftype, body_style),
            Paragraph(fdesc, body_style)
        ])

    t_mod = Table(table_data, colWidths=[150, 150, 240])
    t_mod.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0, 0), (-1, -1), 3.5),
    ]))
    story.append(t_mod)
    story.append(Spacer(1, 8))

doc.build(story)
print("PDF successfully generated at:", pdf_filename)
