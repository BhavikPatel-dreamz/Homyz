# Homyz Pricing & Fee Calculation Flow Audit

**Date:** September 14, 2026  
**System:** Complete pricing and tax calculation audit

---

## Table of Contents
1. [Guest Service Fee Calculations](#1-guest-service-fee-calculations)
2. [Tax Calculation Logic](#2-tax-calculation-logic)
3. [Pricing Calculations (Frontend, Backend, Database)](#3-pricing-calculations-frontend-backend-database)
4. [Booking Price Breakdown Structure](#4-booking-price-breakdown-structure)
5. [Database Schema for Pricing & Fees](#5-database-schema-for-pricing--fees)
6. [Pricing Values in Database](#6-pricing-values-in-database)
7. [Weekday/Weekend Pricing](#7-weekdayweekend-pricing)
8. [Admin Settings & Configuration](#8-admin-settings--configuration)
9. [Price Display Across UI](#9-price-display-across-ui)
10. [Booking APIs & Endpoints](#10-booking-apis--endpoints)

---

## 1. Guest Service Fee Calculations

### Current Implementation
**Guest Service Fee = 20% of base price**

#### Locations Where Calculated:

1. **Onboarding - Weekday Price Step**
   - File: [components/host/onboarding/step-price.tsx](components/host/onboarding/step-price.tsx#L30-L38)
   - Lines: 30-38
   - Code:
     ```typescript
     const guestServiceFee = Math.round(price * 0.2);
     const guestPriceBeforeTaxes = price + guestServiceFee;
     const hostEarnings = Math.round(price * 0.97);
     ```
   - Shows: 20% service fee, price before taxes, and host earnings (97% after 3% platform fee)

2. **Onboarding - Weekend Price Step**
   - File: [components/host/onboarding/step-weekend-price.tsx](components/host/onboarding/step-weekend-price.tsx#L36-L44)
   - Lines: 36-44
   - Code:
     ```typescript
     const guestServiceFee = Math.round(activeWeekendPrice * 0.2);
     const guestPriceBeforeTaxes = activeWeekendPrice + guestServiceFee;
     const hostEarnings = Math.round(activeWeekendPrice * 0.97);
     ```

3. **Host Workspace Reservation Details**
   - File: [components/host/host-workspace-shared.tsx](components/host/host-workspace-shared.tsx#L173-L179)
   - Lines: 173-179
   - Code:
     ```typescript
     const nightlyRate = listing.price;
     const roomFee = nights * nightlyRate;
     const cleaningFee = listing.cleaningFee || Math.round(nightlyRate * 0.35);
     const serviceFee = Math.round(roomFee * 0.12);  // 12% on room fee
     const guestTotal = roomFee + cleaningFee + serviceFee;
     const hostServiceFee = Math.round(roomFee * 0.03);  // 3% platform fee
     const hostPayout = roomFee + cleaningFee - hostServiceFee;
     ```
     - **Note:** In host workspace, service fee is 12% of room fee, NOT 20%

### Inconsistency Alert
⚠️ **Guest Service Fee differs between contexts:**
- **Onboarding (pricing setup):** 20% of nightly price
- **Host workspace (reservation details):** 12% of room fee (total of all nights)

---

## 2. Tax Calculation Logic

### Tax Calculator Engine
- File: [lib/tax/tax-calculator.ts](lib/tax/tax-calculator.ts)
- Lines: 1-300+

### Key Methods

#### Main Calculation Entry Point
- **Method:** `TaxCalculator.calculateTaxes(params: TaxCalculationParams)`
- **Location:** [lib/tax/tax-calculator.ts](lib/tax/tax-calculator.ts#L20)
- **Returns:** `TaxCalculationResult` with:
  - `taxes: CalculatedTaxItem[]` - array of calculated tax items
  - `taxTotal: number` - total tax amount in cents
  - `platformRemittedTaxTotal: number` - taxes platform collects & remits
  - `hostRemittedTaxTotal: number` - taxes host collects & remits
  - `guestTotal: number` - total charge to guest
  - `payoutBreakdown: HostPayoutBreakdown` - host earnings breakdown
  - `currency: string` - currency code

#### Tax Rule Evaluation
- **Method:** `evaluateRule(opts)` - Evaluates system-managed tax rules
- **Location:** [lib/tax/tax-calculator.ts](lib/tax/tax-calculator.ts#L148)
- **Logic:**
  - Checks for long-stay exemptions (if `nights >= longStayExemptionNights`)
  - Calculates taxable base using specified components
  - Computes tax amount based on calculation method
  - Returns marked as exempt if eligibility criteria met

#### Host Tax Evaluation
- **Method:** `evaluateHostTax(opts)` - Evaluates host-configured listing taxes
- **Location:** [lib/tax/tax-calculator.ts](lib/tax/tax-calculator.ts#L215)
- **Special Logic:**
  - Long-stay exemption check
  - Per-person-per-night maximum capping
  - Returns `CalculatedTaxItem` with exemption status

#### Taxable Base Calculation
- **Method:** `calculateTaxableBase(amounts, components)`
- **Location:** [lib/tax/tax-calculator.ts](lib/tax/tax-calculator.ts#L290+)
- **Taxable Components (configurable):**
  - `BASE_PRICE` - accommodation subtotal
  - `CLEANING_FEE` - cleaning charges
  - `PET_FEE` - pet fees
  - `GUEST_FEE` - extra guest charges

#### Tax Amount Computation
- **Method:** `computeAmount(opts)` - Calculates final tax amount
- **Location:** [lib/tax/tax-calculator.ts](lib/tax/tax-calculator.ts#L300+)
- **Calculation Methods Supported:**
  - `PERCENTAGE` - tax rate as percentage
  - `FLAT_PER_BOOKING` - flat amount per booking
  - `AMOUNT_PER_NIGHT` - per night amount
  - `AMOUNT_PER_GUEST` - per guest amount
  - `AMOUNT_PER_GUEST_PER_NIGHT` - per guest per night

### Host Payout Calculation
- **Location:** [lib/tax/tax-calculator.ts](lib/tax/tax-calculator.ts#L93-L110)
- **Formula:**
  ```
  platformServiceFee = accommodationSubtotal × 0.03  (3% commission)
  netHostPayout = accommodationSubtotal + cleaningFee + petFee 
                  + hostRemittedTaxTotal - platformServiceFee
  ```

### Tax Types Supported
- File: [lib/tax/types.ts](lib/tax/types.ts)
- Types:
  - `VAT` - Value Added Tax
  - `GST` - Goods & Services Tax
  - `TOURIST_TAX` - Tourist tax
  - `OCCUPANCY_TAX` - Occupancy tax
  - `LODGING_TAX` - Lodging tax
  - `SALES_TAX` - Sales tax
  - `CITY_TAX` - City tax
  - `OTHER` - Other taxes

### Remittance Responsibility
- `PLATFORM` - Platform collects and remits
- `HOST` - Host collects and remits
- `THIRD_PARTY` - Third party handles
- `MANUAL` - Manual remittance

---

## 3. Pricing Calculations (Frontend, Backend, Database)

### Backend Booking Quote Engine

#### Main Service Function
- **File:** [services/booking.service.ts](services/booking.service.ts#L59)
- **Function:** `getBookingQuote(opts: { listingId, checkIn, checkOut, guests?, pets? })`
- **Type:** `export async function`

#### Quote Calculation Steps

1. **Fetch Listing & Tax Configuration**
   - Location: [services/booking.service.ts](services/booking.service.ts#L59-L75)
   - Retrieves listing with active taxes included
   - Validates listing is published and active

2. **Date Processing & Night Calculation**
   - Location: [services/booking.service.ts](services/booking.service.ts#L75-L95)
   - Normalizes dates to UTC start of day
   - Calculates exact number of nights
   - Validates against minNights/maxNights

3. **Guest & Pet Validation**
   - Location: [services/booking.service.ts](services/booking.service.ts#L95-L110)
   - Checks guest count vs. listing capacity
   - Validates pet count and allergies
   - Checks petFee if applicable

4. **Base Price Determination**
   - Location: [services/booking.service.ts](services/booking.service.ts#L109-L120)
   - Gets basePrice from `listing.price` (in cents)
   - Determines if manual pricing adjustments apply
   - Smart pricing check: `listing.smartPricing !== true` enables manual adjustments

5. **Weekday/Weekend Price Application**
   - Location: [services/booking.service.ts](services/booking.service.ts#L120-L145)
   - Breaks down each night:
     - Thursday (4) and Friday (5) = weekend
     - All other days = weekday
   - Applies `weekendPrice` if available and manual pricing active
   - Generates daily breakdown array with date, isWeekend flag, and price

6. **Discount Calculation**
   - Location: [services/booking.service.ts](services/booking.service.ts#L145-L155)
   - Checks discount config from `listing.discounts` JSON
   - Applies discount based on length of stay:
     - 28+ nights: monthly discount
     - 7-27 nights: weekly discount
     - <7 nights: no discount
   - Formula: `discountAmount = nightlySubtotal × (discountPercentage / 100)`

7. **Subtotal Calculation**
   - Location: [services/booking.service.ts](services/booking.service.ts#L155)
   - Formula: `subtotal = nightlySubtotal - discountAmount + cleaningFee`

8. **Tax Calculation (Deterministic)**
   - Location: [services/booking.service.ts](services/booking.service.ts#L156-L190)
   - Resolves jurisdiction from listing location
   - Maps listing taxes to DTOs
   - Calls `TaxCalculator.calculateTaxes()` with:
     - nights
     - nightlySubtotal
     - discountAmount
     - cleaningFee
     - guests
     - system rules & host taxes
     - currency

9. **Return Quote Object**
   - Location: [services/booking.service.ts](services/booking.service.ts#L190-L230)
   - Returns full `BookingQuote` type with all calculations

### Frontend Quote Request

#### Public Listing Detail Component
- **File:** [app/listings/[id]/public-listing-detail-client.tsx](app/listings/[id]/public-listing-detail-client.tsx#L100-L129)
- **Function:** Quote fetching with live updates
- **Logic:**
  ```typescript
  // Debounced fetch to quote endpoint
  fetch(`/api/v1/listings/${listing.id}/quote?checkIn=...&checkOut=...&guests=...`)
    .then(res => res.json())
    .then(data => setQuote(data.data))
  ```

#### Guest Total Displayed
- **Formula:** `guestTotal = subtotal + taxTotal`
- **Location:** Quote breakdown in listing detail page

### Database Queries

#### Listing Pricing Fetch
- **Location:** [services/booking.service.ts](services/booking.service.ts#L59-L65)
- **Query:**
  ```typescript
  const listing = await prisma.listing.findUnique({
    where: { id: opts.listingId },
    include: { taxes: { where: { isActive: true } } },
  });
  ```

#### Retrieved Fields
- `price` - base nightly price in cents
- `weekendPrice` - weekend nightly price in cents (optional)
- `cleaningFee` - cleaning fee in cents
- `smartPricing` - boolean for smart pricing toggle
- `discounts` - JSON object with discount configuration
- `taxes` - array of ListingTax with active taxes only

---

## 4. Booking Price Breakdown Structure

### BookingQuote Type Definition
- **File:** [services/booking.service.ts](services/booking.service.ts#L19-L50)
- **Type:** Complete price breakdown structure

```typescript
export type BookingQuote = {
  listingId: string;
  checkIn: string;           // ISO string
  checkOut: string;          // ISO string
  nights: number;
  weekdayNights: number;
  weekendNights: number;
  baseNightlyPrice: number;        // cents
  weekendNightlyPrice: number | null;  // cents
  nightlySubtotal: number;         // cents
  discountAmount: number;          // cents
  discountPercentage: number;
  cleaningFee: number;             // cents
  subtotal: number;                // before tax
  totalPrice: number;              // cents (before tax for compatibility)
  taxes: CalculatedTaxItem[];
  taxTotal: number;
  platformRemittedTaxTotal: number;
  hostRemittedTaxTotal: number;
  guestTotal: number;              // after tax (final guest charge)
  payoutBreakdown?: HostPayoutBreakdown;
  currency: string;
  guests: number;
  pets: number;
  cancellationPolicy: string;
  cancellationPolicyType: "SHORT_TERM" | "LONG_TERM";
  breakdown: Array<{
    date: string;              // YYYY-MM-DD
    isWeekend: boolean;
    price: number;             // cents
  }>;
};
```

### Host Payout Breakdown
- **File:** [lib/tax/types.ts](lib/tax/types.ts)
- **Structure:**
  ```typescript
  HostPayoutBreakdown = {
    accommodationSubtotal: number;
    cleaningFee: number;
    petFee: number;
    taxesCollectedForHost: number;
    taxesRemittedByPlatform: number;
    platformServiceFee: number;  // 3% of accommodation
    netHostPayout: number;
    currency: string;
  }
  ```

### Calculated Tax Item
- **File:** [lib/tax/types.ts](lib/tax/types.ts)
- **Structure:**
  ```typescript
  CalculatedTaxItem = {
    taxRuleId?: string;
    taxName: string;
    taxType: TaxType;
    calculationMethod: TaxCalculationMethod;
    rate?: number;
    amount?: number;
    taxableBase: number;
    taxAmount: number;  // cents
    currency: string;
    remittanceResponsibility: TaxRemittanceResponsibility;
    isInclusive: boolean;
    isExempt: boolean;
    exemptionReason?: string;
  }
  ```

### Price Breakdown in UI
- **File:** [app/listings/[id]/public-listing-detail-client.tsx](app/listings/[id]/public-listing-detail-client.tsx#L619-L660)
- **Display Components:**
  - Weekday nights breakdown
  - Weekend nights breakdown (if applicable)
  - Cleaning fee (if > 0)
  - Discount (if applied)
  - Tax itemization (if any taxes)
  - Guest total

---

## 5. Database Schema for Pricing & Fees

### Listing Model - Pricing Fields
- **File:** [prisma/schema.prisma](prisma/schema.prisma#L298-L471)
- **Location:** Listing model, lines ~430-440

#### Pricing Fields:
```prisma
model Listing {
  // Base pricing
  price              Int     // in cents (SAR halalas)
  
  // Weekend pricing
  weekendPrice       Int?    // Weekend nightly price in cents
  weekendPremium     Int?    // Weekend premium percentage
  
  // Fees
  cleaningFee        Int?    // in cents, @default(0)
  securityDeposit    Int?    // in cents, @default(0)
  petFee             Int?    // in cents (optional per-pet fee)
  
  // Smart pricing
  smartPricing       Boolean @default(false)
  smartPricingMinPrice Int?  // Minimum nightly price in cents
  smartPricingMaxPrice Int?  // Maximum nightly price in cents
  
  // Discounts
  discounts          Json?   // JSON configuration for weekly/monthly discounts
  
  // Availability constraints
  minNights          Int     @default(1)
  maxNights          Int     @default(365)
  blockedDates       String[] @default([])
  
  // Cancellation policies
  cancellationPolicy         String? @default("FLEXIBLE")
  longTermCancellationPolicy String? @default("FIRM")
  
  // Tax configuration
  taxes              ListingTax[]
}
```

### Booking Model - Pricing Fields
- **File:** [prisma/schema.prisma](prisma/schema.prisma#L502-L540)
- **Location:** Booking model

```prisma
model Booking {
  id                 String    @id @default(cuid())
  
  // Booking details
  startDate          DateTime
  endDate            DateTime
  guests             Int       @default(1)
  
  // Pricing snapshot
  totalPrice         Int?      // Minor units / cents (guest total after tax)
  nightlyPrice       Int?      // Base nightly price in cents
  cleaningFee        Int?      // in cents
  currency           String    @default("SAR")
  
  // Complete breakdown snapshot
  priceBreakdown     Json?     // Full BookingQuote stored as JSON
  
  // Policy snapshot
  cancellationPolicy String?   // Applicable policy at booking time
  
  // Tax records
  taxes              ReservationTax[]
}
```

### ListingTax Model
- **File:** [prisma/schema.prisma](prisma/schema.prisma#L995-L1030)
- **Purpose:** Host-configured taxes per listing

```prisma
model ListingTax {
  id                             String
  listingId                      String
  taxRuleId                      String?  // Link to system rule
  customName                     String?  // Custom tax name
  
  // Tax configuration
  taxType                        TaxType
  calculationMethod              TaxCalculationMethod  // PERCENTAGE, FLAT_PER_BOOKING, etc.
  rate                           Float?   // e.g. 15.0 for 15%
  amount                         Int?     // Fixed amount in cents
  
  // What to tax
  taxableComponents              String[] // BASE_PRICE, CLEANING_FEE, PET_FEE, GUEST_FEE
  
  // Remittance
  remittanceResponsibility       TaxRemittanceResponsibility  // PLATFORM, HOST, etc.
  
  // Exemptions
  maximumAmountPerPersonPerNight Int?
  partialStayExemptionNights     Int?
  fullStayExemptionNights        Int?
  longStayExemptionNights        Int?
  
  isActive                       Boolean  @default(true)
  createdAt                      DateTime @default(now())
  updatedAt                      DateTime @updatedAt
  
  @@unique([listingId, customName])
}
```

### ReservationTax Model
- **File:** [prisma/schema.prisma](prisma/schema.prisma#L1040-L1060)
- **Purpose:** Tax snapshot at time of booking

```prisma
model ReservationTax {
  id                       String
  bookingId                String
  taxRuleId                String?
  taxRuleVersion           Int     @default(1)
  
  // Tax details snapshot
  taxName                  String
  taxType                  TaxType
  calculationMethod        TaxCalculationMethod
  rate                     Float?
  amount                   Int?    // Fixed amount
  
  // Calculation results
  taxableBase              Int     // in cents
  taxAmount                Int     // in cents
  
  currency                 String  @default("SAR")
  remittanceResponsibility TaxRemittanceResponsibility
  refundedTax              Int     @default(0)  // if applicable
  createdAt                DateTime @default(now())
  
  @@index([bookingId])
}
```

---

## 6. Pricing Values in Database

### Pricing Storage Convention
- **All monetary values stored in MINOR UNITS (cents/halalas)**
- **Currency:** SAR (Saudi Riyal)
- **Display:** Divide by 100 for customer display

### How Prices are Saved

#### From Onboarding Flow
- **File:** [components/host/new-listing-get-started.tsx](components/host/new-listing-get-started.tsx#L242)
- **Conversion:**
  ```typescript
  weekendPrice: weekendPrice > 0 ? Math.round(weekendPrice * 100) : null
  ```
  - Input: decimal (e.g., 250.50)
  - Storage: cents (e.g., 25050)

#### From Calendar Settings
- **File:** [components/host/calendar-settings-panel.tsx](components/host/calendar-settings-panel.tsx#L174-L178)
- **Conversion:**
  ```typescript
  weekendPrice: Math.round(number("weekendPrice") * 100)
  discounts: { ...discounts, weekly, monthly }
  cleaningFee: Math.round(number("cleaningFee") * 100)
  ```

#### From Admin Actions
- **File:** [actions/admin/listingActions.ts](actions/admin/listingActions.ts#L128-L143)
- **Conversion:**
  ```typescript
  cleaningFee: Math.max(0, Math.round(input.cleaningFee))
  ```

### How Prices are Retrieved

#### Frontend Component Display
- **File:** [components/listings/listing-card.tsx](components/listings/listing-card.tsx#L29-L40)
- **Conversion:**
  ```typescript
  const formattedPrice = Math.round(listing.price / 100);
  // Display: `SAR ${formattedPrice} / night`
  ```

#### Quote Display
- **File:** [app/listings/[id]/public-listing-detail-client.tsx](app/listings/[id]/public-listing-detail-client.tsx#L619-L660)
- **Display:**
  ```typescript
  SAR {Math.round(quote.weekendNightlyPrice / 100)} / night
  SAR {Math.round(quote.cleaningFee / 100)}
  ```

#### Host Workspace Display
- **File:** [components/host/host-workspace-shared.tsx](components/host/host-workspace-shared.tsx#L299-L327)
- **Helper Function:** `money()` utility
- **Display:** Formatted SAR amounts from cents

---

## 7. Weekday/Weekend Pricing

### Weekend Definition
- **Thursday (day 4) and Friday (day 5)**
- **Implementation:** [services/booking.service.ts](services/booking.service.ts#L127-L145)
- **Code:**
  ```typescript
  const dayOfWeek = nightDate.getDay();
  // Saudi / Middle East weekend nights: Thursday (4) and Friday (5)
  const isWeekend = dayOfWeek === 4 || dayOfWeek === 5;
  ```

### Weekend Price Configuration

#### Setting Weekend Price
1. **Onboarding Flow**
   - File: [components/host/onboarding/step-weekend-price.tsx](components/host/onboarding/step-weekend-price.tsx#L1-L180)
   - Component shows current weekday vs. weekend comparison
   - Slider adjusts price as percentage of weekday
   - Stores: `weekendPrice` in cents

2. **Calendar Settings Panel**
   - File: [components/host/calendar-settings-panel.tsx](components/host/calendar-settings-panel.tsx#L219-L236)
   - Expandable "Custom weekend price" section
   - Input field for SAR amount
   - Stores: `weekendPrice` (multiplied by 100)

3. **Listing Editor Workspace**
   - File: [components/host/host-listings-workspace.tsx](components/host/host-listings-workspace.tsx#L1093-L1120)
   - "Weekend Rate (SAR)" input field
   - Stores: `Math.round(Number(e.target.value) * 100)`

#### Weekend Price Application
- **Logic:** [services/booking.service.ts](services/booking.service.ts#L109-L145)
- **Conditions:**
  1. Manual pricing must be active: `usesManualAdjustments === true`
  2. Weekend price must be set: `weekendPrice > 0`
  3. Day must be weekend: `isWeekend === true`
- **Application:** Applied per-night during stay breakdown calculation

#### Smart Pricing Override
- **File:** [services/booking.service.ts](services/booking.service.ts#L113-L120)
- **Logic:**
  ```typescript
  const usesManualAdjustments = listing.smartPricing !== true;
  const weekendPrice = usesManualAdjustments && listing.weekendPrice && listing.weekendPrice > 0
    ? listing.weekendPrice
    : null;
  ```
- **Effect:** When `smartPricing === true`, weekend price is ignored

### Weekend Premium Calculation
- **Location:** [app/(protected)/host/listings/[id]/components/PricingAndBookingViews.tsx](app/(protected)/host/listings/[id]/components/PricingAndBookingViews.tsx#L222-L255)
- **Formula:** `weekendPrice = basePrice × (1 + weekendPremium / 100)`
- **Display:** Shows premium percentage in UI with +/- buttons

---

## 8. Admin Settings & Configuration

### Admin Settings Form
- **File:** [components/admin/admin-settings-form.tsx](components/admin/admin-settings-form.tsx)
- **Purpose:** Admin password change only
- **Does NOT contain pricing settings**

### Admin Page
- **File:** [app/(protected)/admin/settings/page.tsx](app/(protected)/admin/settings/page.tsx)
- **Route:** `/admin/settings`
- **Contains:** Admin settings form for password management

### Tax Administration
- **Location:** Not explicitly audited, but infrastructure exists in:
  - [app/api/v1/taxes/](app/api/v1/taxes/) directory
  - Tax rules managed via system
  - Host tax configuration via ListingTax model

### Listing Admin Management
- **File:** [app/(protected)/admin/listings/admin-listings-client.tsx](app/(protected)/admin/listings/admin-listings-client.tsx)
- **Features:**
  - Bulk listing view with price display
  - Individual listing edit modal
  - Price edit fields: nightly rate, weekend price
  - Clean price formatting via `formatSarFromHalalas()`

#### Admin Listing Editor Tab 5
- **Location:** [app/(protected)/admin/listings/admin-listings-client.tsx](app/(protected)/admin/listings/admin-listings-client.tsx#L1093-L1150)
- **Section:** "Pricing & Fees"
- **Fields:**
  - Nightly Rate (SAR)
  - Weekend Rate (SAR)
  - Cleaning Fee
  - Security Deposit

---

## 9. Price Display Across UI

### Listing Card Component
- **File:** [components/listings/listing-card.tsx](components/listings/listing-card.tsx)
- **Display:**
  ```tsx
  <span className="font-semibold text-zinc-950 text-sm">
    SAR {formattedPrice}
  </span>
  <span className="text-zinc-500 font-normal">/ night</span>
  ```
- **Conversion:** `Math.round(listing.price / 100)`

### Home View Cards
- **File:** [components/home/home-view.tsx](components/home/home-view.tsx#L50-L70)
- **Data Structure:**
  ```typescript
  cards: PropertyCardData[] = listings.map(l => ({
    price: l.price,  // in cents
    ...
  }))
  ```

### Public Listing Detail - Price Breakdown
- **File:** [app/listings/[id]/public-listing-detail-client.tsx](app/listings/[id]/public-listing-detail-client.tsx#L619-L680)
- **Displays:**
  - Weekday nightly rate
  - Weekend nightly rate (if different)
  - Weekday/weekend night count
  - Cleaning fee
  - Discounts applied
  - Tax itemization
  - **Guest total (final)**

### Saved Listings View
- **File:** [components/profile/saved-listings-view.tsx](components/profile/saved-listings-view.tsx#L155-L175)
- **Display:**
  ```tsx
  <span className="text-sm font-semibold text-[#1F1F1F]">SAR {item.pricePerNight}</span>
  <span className="text-xs text-[#727272]">/ night</span>
  ```

### Host Calendar Sidebar
- **File:** [components/host/host-calendar-workspace.tsx](components/host/host-calendar-workspace.tsx#L485-L500)
- **Component:** CalendarSettingsPanel shows:
  - Current base price
  - Weekend price adjustment
  - Cleaning fee
  - Discount configuration

### Host Listing Editor Pricing Section
- **File:** [app/(protected)/host/listings/[id]/components/PricingAndBookingViews.tsx](app/(protected)/host/listings/[id]/components/PricingAndBookingViews.tsx#L148-L310)
- **Displays:**
  - Smart pricing toggle
  - Nightly price input
  - Weekend adjustment slider
  - Weekly discount (7+ nights)
  - Monthly discount (28+ nights)

### Host Workspace Reservation Details
- **File:** [components/host/host-workspace-shared.tsx](components/host/host-workspace-shared.tsx#L299-L330)
- **Sections:**
  - **Guest Paid:**
    - Nightly rate × nights
    - Cleaning fee
    - Homyz service fee (12% of room fee)
    - Total (SAR)
  - **Host Payout:**
    - Night room fee
    - Host service fee deducted (3.0% + VAT)
    - Total payout (SAR)

### Admin Listing Detail
- **File:** [app/(protected)/admin/listings/[id]/admin-listing-detail-client.tsx](app/(protected)/admin/listings/[id]/admin-listing-detail-client.tsx#L534-L560)
- **Display:**
  - Nightly Rate card with formatted price
  - Price per night in monospace font
  - Color-coded (emerald-600)

---

## 10. Booking APIs & Endpoints

### Booking Creation Endpoint
- **Route:** `POST /api/v1/bookings`
- **File:** [app/api/v1/bookings/route.ts](app/api/v1/bookings/route.ts)
- **Handler:** `apiHandler` wrapping booking service
- **Authentication:** Required via `requireApiAuth()`
- **Request Schema:** [lib/validation/booking.ts](lib/validation/booking.ts#L3)
  ```typescript
  createBookingSchema = z.object({
    listingId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    guests: z.number().int().min(1).max(50).optional().default(1),
    pets: z.number().int().min(0).max(20).optional(),
  })
  ```
- **Response:** `created(booking)` - newly created BookingDTO

### Booking Quote Endpoint
- **Route:** `GET /api/v1/listings/[id]/quote`
- **File:** [app/api/v1/listings/[id]/quote/route.ts](app/api/v1/listings/[id]/quote/route.ts)
- **Parameters:** Query string
  - `checkIn` (or `startDate`) - ISO date string
  - `checkOut` (or `endDate`) - ISO date string
  - `guests` - number (default: 1)
  - `pets` - number (default: 0)
- **Validation Schema:** [lib/validation/booking.ts](lib/validation/booking.ts#L18)
  ```typescript
  quoteBookingSchema = z.object({
    listingId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    guests: z.coerce.number().int().min(1).max(50).optional().default(1),
    pets: z.coerce.number().int().min(0).max(20).optional(),
  })
  ```
- **Response:** `ok(quote)` - BookingQuote object with full breakdown

### Get Bookings Endpoint
- **Route:** `GET /api/v1/bookings`
- **File:** [app/api/v1/bookings/route.ts](app/api/v1/bookings/route.ts)
- **Authentication:** Required
- **Pagination:** Via `parsePagination()`
- **Response:** Paginated list of user's own bookings

### Booking Service Methods
- **File:** [services/booking.service.ts](services/booking.service.ts#L395-L399)

#### `bookingService.getQuote(opts)`
- **Function:** `getBookingQuote(opts)`
- **Returns:** `BookingQuote` with full pricing details
- **Used by:** Quote endpoint and booking creation

#### `bookingService.create(actor, input)`
- **Creates:** New booking after quote calculation
- **Steps:**
  1. Validates listing exists and is active
  2. Checks if host is booking own listing (forbidden)
  3. Determines booking approval mode
  4. Calculates authoritative quote
  5. Checks blocked dates
  6. Uses transaction with advisory lock for concurrency
  7. Checks for date conflicts
  8. Creates booking with snapshot data
  9. Saves full priceBreakdown as JSON

#### `bookingService.listForUser(actor, opts)`
- **Returns:** Paginated bookings for authenticated user
- **Caching:** Cache-aside pattern with Redis

#### `bookingService.getById(actor, id)`
- **Returns:** Single booking by ID with ownership check

### Frontend Quote Fetching
- **Location:** [app/listings/[id]/public-listing-detail-client.tsx](app/listings/[id]/public-listing-detail-client.tsx#L100-L129)
- **Method:** Debounced fetch on date/guest changes
- **Error Handling:** Sets quote error state
- **Loading State:** `isQuoteLoading` during calculation

### Booking Creation Flow (Frontend)
- **Location:** [app/listings/[id]/public-listing-detail-client.tsx](app/listings/[id]/public-listing-detail-client.tsx#L129-L165)
- **Handler:** `handleReserve()`
- **Steps:**
  1. Validates check-in/check-out dates selected
  2. POSTs to `/api/v1/bookings` with booking data
  3. Handles response (success redirects, error shows alert)
  4. Shows loading state during submission

---

## Summary Statistics

### Database Models with Pricing
- **Listing** - Primary pricing configuration
- **Booking** - Price snapshot storage
- **ListingTax** - Host tax configuration
- **ReservationTax** - Tax snapshot at booking
- **TaxRule** - System-wide tax rules (not directly detailed)

### Key Calculation Points
1. **Onboarding:** Guest sees 20% service fee on set price
2. **Booking Quote:** Full breakdown with all fees and taxes
3. **Booking Confirmation:** Snapshot stored in `priceBreakdown` JSON
4. **Host Reservation View:** 12% service fee shown
5. **Admin View:** Clean pricing display with formatting

### API Endpoints for Pricing
- `POST /api/v1/bookings` - Create booking (triggers price finalization)
- `GET /api/v1/listings/[id]/quote` - Get price quote
- `GET /api/v1/bookings` - List bookings with prices

### Frontend Components
- **Onboarding:** step-price.tsx, step-weekend-price.tsx
- **Listing Display:** listing-card.tsx, public-listing-detail-client.tsx
- **Host Management:** calendar-settings-panel.tsx, PricingAndBookingViews.tsx
- **Admin:** admin-listings-client.tsx, admin-listing-detail-client.tsx

### Key Files Reference
| Category | Files |
|----------|-------|
| Tax Logic | lib/tax/tax-calculator.ts, lib/tax/types.ts |
| Booking Service | services/booking.service.ts |
| API Endpoints | app/api/v1/bookings/route.ts, app/api/v1/listings/[id]/quote/route.ts |
| Database | prisma/schema.prisma |
| Components | Multiple in components/host/ and app/ directories |
| Validation | lib/validation/booking.ts, lib/validation/listing.ts |

---

## Inconsistencies & Issues Found

### 🔴 Critical Issue: Conflicting Service Fee Calculations
- **Onboarding shows 20%** of nightly price as guest service fee
- **Host workspace shows 12%** of room fee as "Homyz service fee"
- **Impact:** Guest sees different fee breakdown during onboarding vs. actual booking

### 🟡 Warning: Guest Service Fee Not in Tax System
- Guest service fee (12% or 20%) is not captured in the tax calculation system
- It's a separate manual calculation, not configurable per listing
- No tax remittance responsibility tracking for this fee

### 🟡 Warning: Discount Configuration as JSON
- Discounts stored as JSON object without schema validation
- No type safety for discount structure
- Example structure inferred but not documented

### 🟡 Warning: Smart Pricing Disabled Features
- Smart pricing toggle exists but functionality incomplete
- Weekend price ignored when smart pricing is enabled
- Min/max smart pricing prices stored but not used

### 🟡 Note: Admin Pricing Settings Limited
- Admin settings form only handles password changes
- Pricing edits available only in listings detail modal
- No bulk pricing update capability

---

## Recommendations

1. **Standardize Service Fee:** Decide on 12% or 20% and use consistently
2. **Integrate Service Fee in Tax System:** Track as remittance item
3. **Validate Discount JSON:** Create proper schema validation
4. **Complete Smart Pricing:** Implement actual pricing optimization logic
5. **Document Pricing Fields:** Add inline documentation to schema
6. **Add Audit Trail:** Log all pricing changes with timestamps

