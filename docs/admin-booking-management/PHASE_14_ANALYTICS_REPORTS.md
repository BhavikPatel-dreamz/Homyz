# Phase 14 — Booking Analytics, Refund Reports & Export

## 1. Overview & Objective

Phase 14 delivers comprehensive operational, financial, property, and host performance analytics alongside an enterprise-grade reporting and export engine for the **Homyz** property booking platform.

The core objectives are:
1. Provide administrators with clear visibility into booking velocity, stay lifecycle distribution, cancellation patterns, payment capture performance, refund volumes, and dispute resolutions.
2. Maintain strict multi-currency segregation so financial metrics in different currencies (e.g. SAR, USD, EUR, AED) are never erroneously combined as scalar numbers.
3. Establish 8 standard operational and financial report categories with live data preview and instant CSV export protected against CSV formula injection (RFC 4180 compliance).

---

## 2. Core Architecture & Features

### 2.1 Analytics Admin Service (`services/analytics-admin.service.ts`)
- **Booking & Financial Overview (`getBookingAnalyticsOverview`)**:
  - Time-window filtering: `today`, `7d`, `30d`, `this_month`, `last_month`, `90d`, `this_year`, or custom `startDate`/`endDate`.
  - **7 Primary KPI Metrics**:
    1. Total Reservations
    2. Active Confirmed Bookings
    3. Completed Stays
    4. Cancelled Bookings
    5. Pending Requests
    6. Cancellation Rate (`(cancelled / total) * 100`, zero-safe)
    7. Multi-Currency Financial Volumes: Segregated totals for Gross Captured, Refunded, and Net Collected.
  - **Stay Lifecycle Partitioning**: Distinguishes between stay completion dates (`endDate < now`) and booking confirmation dates (`status === CONFIRMED`).
  - **Time-Series Trends**: Daily bucketing of new reservations, confirmed stays, completed stays, and cancellations for interactive SVG trend charting.
  - **Payment & Refund Health**: Captures successful captures, failed attempts, pending authorizations, and payment provider volumes.
  - **Cancellation Reasons Breakdown**: Aggregates top cancellation reasons reported by guests and hosts.
  - **Dispute Incident Distribution**: Aggregates open, reviewing, resolved, and closed quality incidents with category counts.
- **Property Performance Analytics (`getPropertyPerformanceAnalytics`)**:
  - Server-side paginated property metrics table with text search across listing title, city, and host name.
  - Calculates reservation count, completed stays, cancellations, gross volume, refund deductions, and net revenue per property.
- **Host Performance Analytics (`getHostPerformanceAnalytics`)**:
  - Server-side paginated host earnings table with text search across host name and email.
  - Calculates listing count, total bookings, completed stays, gross booking volume, net host payouts (via `extractStoredHostPayout` with 3% platform fee fallback), and refund adjustments.
- **Report Generation & CSV Export (`generateReportData` & `exportReportToCsv`)**:
  - Supports 8 standard operational report categories:
    1. `BOOKING_REPORT`: Full reservation registry with guest, host, property, dates, total, and status.
    2. `CANCELLATION_REPORT`: Detailed cancellation logs with reasons, cancellation timestamps, and prices.
    3. `PAYMENT_REPORT`: Payment gateway transaction audit logs with amounts, refunded amounts, and providers.
    4. `REFUND_REPORT`: Itemized refund disbursements with reasons, status, and currency.
    5. `PAYOUT_REPORT`: Host settlement readiness and itemized deductions.
    6. `DISPUTE_REPORT`: Guest/host quality complaints and administrative resolutions.
    7. `PROPERTY_REPORT`: Listing-level occupancy and financial metrics.
    8. `HOST_REPORT`: Host-level reservation volume and payout performance.
  - **CSV Formula Injection Prevention (`sanitizeCsvCell`)**:
    - Prepend single quote (`'`) to any cell string starting with formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) to neutralize automatic spreadsheet formula execution in Microsoft Excel, Google Sheets, and LibreOffice.
    - Double quotes (`"`) escaped to `""` per RFC 4180.
    - Audit logging of all CSV export downloads (`REPORT_EXPORTED`).

---

## 3. API Endpoints

| Endpoint | Method | Permission Required | Description |
|---|---|---|---|
| `/api/v1/admin/bookings/analytics/overview` | GET | `ANALYTICS_VIEW` | Comprehensive booking, cancellation, financial, and dispute overview |
| `/api/v1/admin/bookings/analytics/properties` | GET | `ANALYTICS_VIEW` | Paginated property performance metrics |
| `/api/v1/admin/bookings/analytics/hosts` | GET | `ANALYTICS_VIEW` | Paginated host earnings and payout metrics |
| `/api/v1/admin/bookings/reports` | GET | `ANALYTICS_VIEW` | Tabular report preview data across 8 supported categories |
| `/api/v1/admin/bookings/reports/export` | POST | `ANALYTICS_EXPORT` | Generates sanitized RFC 4180 CSV download with audit logging |

---

## 4. UI/UX Implementation

### 4.1 Admin Booking Analytics (`/admin/bookings/analytics`)
- **Interactive Period Selector**: Quick filter tabs (`Last 7 Days`, `Last 30 Days`, `This Month`, `Last Month`, `90 Days`, `This Year`, `Custom`).
- **7 Summary KPI Cards**: Distinctive Airbnb-styled metric cards with trend indicators and currency breakdown.
- **SVG Trend Chart**: Lightweight, zero-dependency responsive SVG line/area chart depicting reservation volume velocity over time.
- **Stay Lifecycle & Cancellation Distribution**: Visual proportion bars for pending, confirmed, completed, and cancelled stays.
- **Property & Host Performance Tables**: Tabular views with search bars, badges, and responsive overflow controls.

### 4.2 Admin Booking Reports & Export (`/admin/bookings/reports`)
- **8 Report Category Cards**: Card selector with distinct iconography and descriptions.
- **Filter Toolbar**: Date range inputs, status selector, currency selector, and row count limit.
- **Live Preview Table**: Interactive preview rendering up to 100 rows with clear column formatting.
- **One-Click CSV Export**: Initiates automated download of sanitized CSV file with automatic filename formatting (`report-[type]-[date].csv`).

---

## 5. Financial & Security Standards

1. **Multi-Currency Segregation**: All calculations maintain separate currency dictionaries (`Record<string, { grossCaptured, refunded, netCollected }>`). No currency amounts are added across boundaries without verified exchange rates.
2. **Formula Injection Sanitization**: All exported CSV cells are scrubbed through `sanitizeCsvCell` ensuring safe consumption in client spreadsheet applications.
3. **Data Access Audit Logging**: Every export request records an audit entry containing actor details, report type, filter parameters, and row counts.
4. **Layout Contract Adherence**: Both `/analytics` and `/reports` feature matching `loading.tsx` skeletons preserving container widths, header positions, and card grids to eliminate cumulative layout shifts.
