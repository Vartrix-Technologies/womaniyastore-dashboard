# Sale Feature Guide

## Overview

Womaniya Dashboard implements a **two-tier sale system** designed to handle both pre-planned seasonal sales (festivals, promotions) and reactive clearance decisions. This system provides margin protection, comprehensive analytics, and clear visual indicators throughout the application.

## Table of Contents

1. [Two-Tier Sale System](#two-tier-sale-system)
2. [Getting Started](#getting-started)
3. [Using Sales in POS](#using-sales-in-pos)
4. [Margin Protection Rules](#margin-protection-rules)
5. [Reporting & Analytics](#reporting--analytics)
6. [End-to-End Workflows](#end-to-end-workflows)
7. [Troubleshooting](#troubleshooting)

---

## Two-Tier Sale System

### Tier 1: Pre-Planned Sales (Admin Level)
**Use Cases:** Festival sales, seasonal promotions, planned clearances

**Location:** Admin → Inventory → Add Stock Lot

**Features:**
- Mark entire lot as sale type (festival/promotion)
- Set minimum margin percentage (e.g., 20%)
- Add sale reason ("Diwali 2024", "Summer Sale")
- System enforces margin at checkout
- Track performance by festival/promotion name

**Characteristics:**
- ✅ Planned in advance
- ✅ Margin-protected
- ✅ Bulk application (entire lot)
- ✅ Named and trackable
- ✅ Cannot be overridden at POS

### Tier 2: Reactive Sales (POS Level)
**Use Cases:** Quick clearances, ad-hoc discounts, reactive decisions

**Location:** POS → Cart → Individual Items

**Features:**
- Mark individual items as sale during checkout
- Choose sale type (festival/clearance/promotion)
- Override admin settings if needed
- No margin enforcement (staff decision)
- Flexibility for real-time decisions

**Characteristics:**
- ✅ Real-time decisions
- ✅ Item-level control
- ⚠️ No automatic margin protection
- ✅ Can override Tier 1 settings
- ✅ Quick clearance capability

---

## Getting Started

### Step 1: Adding Stock with Sale Markings

1. Go to **Admin → Inventory → Add Stock Lot**
2. Fill in basic details (category, size, vendor, prices)
3. **For Sale Items:**
   - Enable "Mark for Sale" toggle
   - Select sale type:
     - **Festival**: Planned seasonal sales (Diwali, Eid, Christmas)
     - **Clearance**: End-of-season clearance (not pre-planned)
     - **Promotion**: Marketing promotions (Buy 1 Get 1, etc.)
   - Enter minimum margin % (e.g., 20%)
   - Add sale reason/name (e.g., "Diwali 2024")
4. Generate QR codes
5. Print and attach to items

**Visual Indicators:**
- Stock with sale markings shows colored indicators in inventory list:
  - 🟢 Green dot = Festival
  - 🔴 Red dot = Clearance  
  - 🔵 Blue dot = Promotion

### Step 2: Viewing Sale Inventory

**Inventory List:**
- Green/red/blue dots in "Sale Type" column
- Shows sale type name
- Filter by status (available/sold)

**Inventory Detail View:**
- Shows sale type and reason
- Displays minimum margin
- Calculates minimum allowed price

---

## Using Sales in POS

### Scanning Sale Items

1. **Open POS** (Admin → Point of Sale or POS shortcut)
2. **Scan QR code** - Item appears in cart
3. **Check sale indicator:**
   - Items marked as "festival" → Green background
   - Items marked as "clearance" → Red background
   - Items marked as "promotion" → Blue background
4. Original price shown with strikethrough
5. Final price shows actual selling price

### Modifying Sale Type (Individual Item)

**Change sale type for a specific item:**

1. Locate item in cart
2. Click **Sale Type dropdown** (shows current type or "Regular")
3. Select:
   - **Regular** - Remove sale marking
   - **Festival** - Mark as festival sale
   - **Clearance** - Mark as clearance
   - **Promotion** - Mark as promotion
4. Change takes effect immediately
5. Cart updates background color

**Use Cases:**
- Quick clearance: Change "Regular" → "Clearance"
- Reactive promotion: Change any type to "Promotion"
- Remove sale: Change any type → "Regular"
- Override pre-planning: Change "Festival" → "Clearance"

### Checkout with Sale Items

1. Review cart - sale items have colored backgrounds
2. Click **Checkout**
3. **Sale Items Review Section:**
   - Shows all sale items with colored badges
   - Lists: 🟢 FESTIVAL, 🔴 CLEARANCE, 🔵 PROMOTION
   - Cannot be changed here (go back to cart to modify)
4. Enter payment details
5. Click **Complete Sale**

---

## Margin Protection Rules

### Festival Sales (Tier 1 - Strict)

**Rule:** Final price MUST be ≥ Cost Price × (1 + Min Margin %)

**Example:**
- Cost price: ₹1,000
- Min margin: 20%
- **Minimum allowed price: ₹1,200**
- Selling at ₹1,150 → ❌ **Blocked at checkout**
- Selling at ₹1,250 → ✅ **Allowed**

**Error Message:**
```
Festival item "Kurti - Cotton" price (₹1,150) is below minimum margin. 
Min required: ₹1,200.00
```

**Enforcement:**
- ✅ Validated in CheckoutDialog before submission
- ✅ Double-checked in Edge Function
- ✅ Transaction blocked if violation detected
- ✅ Cannot be overridden without admin access

### Clearance Sales (Tier 2 - Flexible)

**Rule:** No margin enforcement

**Use Case:** Reactive clearance to liquidate old stock

**Freedom:**
- ✅ Can sell below cost price
- ✅ Staff decision in real-time
- ⚠️ Track losses in Clearance Report

### Promotion Sales (Tier 1 & 2)

**If set at Tier 1 (admin):**
- Margin protection applied
- Same rules as festival sales

**If set at Tier 2 (POS):**
- No margin protection
- Flexible pricing

---

## Reporting & Analytics

### Sales Page (Main)

**Location:** Admin → Sales

**Features:**

1. **Filter by Sale Type:**
   - Dropdown: All / Regular Only / Mixed / Festival / Clearance / Promotion
   - **Regular Only**: Bills with ALL regular items (no sale items)
   - **Mixed**: Bills with BOTH sale and regular items
   - **Festival/Clearance/Promotion**: Bills with at least one of that type

2. **Sale Performance Cards:**
   - Festival sales: Count + Revenue (green theme)
   - Clearance sales: Count + Revenue (red theme)
   - Promotion sales: Count + Revenue (blue theme)
   - Only shows if data exists

3. **Colored Badges in Table:**
   - Small dots in bill number column
   - Shows sale types present in each bill
   - 🟢 Festival | 🔴 Clearance | 🔵 Promotion

4. **CSV Export:**
   - Includes sale type breakdowns
   - Columns: Regular Items, Festival Items, Clearance Items, Promotion Items
   - Revenue by type

### Festival Sales Report

**Location:** Admin → Sales → Festival Report (or `/admin/reports/festival`)

**Purpose:** Track pre-planned festival sales performance

**Features:**

1. **Summary Stats:**
   - Total items marked for festival
   - Items sold vs unsold
   - Total revenue
   - **Margin violations** (items sold below min margin)

2. **Grouped by Festival:**
   - Shows each festival separately ("Diwali 2024", "Eid 2024")
   - Items in each festival
   - Sold/unsold breakdown

3. **Detailed Table:**
   - Item name, size, status
   - Minimum required price (with margin)
   - Actual sold price
   - Date sold
   - **Red highlighting for violations**

4. **Use Cases:**
   - Verify margin compliance
   - Compare festival performance
   - Identify slow-moving festival stock
   - Plan next festival inventory

### Clearance Analytics Report

**Location:** Admin → Sales → Clearance Report (or `/admin/reports/clearance`)

**Purpose:** Analyze clearance effectiveness and losses

**Features:**

1. **Summary Stats:**
   - Total items cleared
   - Revenue vs cost comparison
   - Total loss/profit amount
   - Average loss percentage
   - Items at loss vs items at profit

2. **Impact Analysis:**
   - **Recovery Rate**: % of cost recovered
   - **Average Discount**: % discount from cost
   - **Loss Ratio**: Loss items : Profit items

3. **Detailed Table:**
   - Item name, size
   - Cost price, original price, sold price
   - **Loss/Profit** amount and percentage
   - Red for losses, green for profits
   - Date cleared

4. **Use Cases:**
   - Understand clearance impact on margins
   - Identify categories with high loss rates
   - Justify clearance decisions with data
   - Set better clearance pricing strategies

---

## End-to-End Workflows

### Workflow 1: Festival Sale (Pre-Planned)

**Scenario:** Diwali 2024 festival sale with 20% minimum margin

1. **Admin Planning (2 weeks before):**
   - Go to Add Stock Lot
   - Enter Diwali inventory details
   - Enable "Mark for Sale" → Festival
   - Set min margin: 20%
   - Sale reason: "Diwali 2024"
   - Generate 50 QR codes
   
2. **Staff Scanning at POS:**
   - Scan item → Shows green background
   - Price: Original ₹1,000 → Selling ₹1,200 (20% margin)
   - Cannot manually change price below ₹1,200
   
3. **Checkout:**
   - System validates margin
   - If price < ₹1,200 → Error, blocked
   - If price ≥ ₹1,200 → Success
   
4. **Post-Sale Analysis:**
   - Open Festival Report
   - See "Diwali 2024" section
   - 35 sold, 15 unsold, ₹42,000 revenue
   - No margin violations

### Workflow 2: Quick Clearance (Reactive)

**Scenario:** Need to clear old stock immediately

1. **POS Staff Decision:**
   - Scan regular item (no pre-marking)
   - Item shows regular (no background color)
   - Click Sale Type dropdown → Select "Clearance"
   - Item turns red background
   
2. **Flexible Pricing:**
   - Original: ₹1,500
   - Cost: ₹1,200
   - Staff marks as clearance, sells for ₹900 (below cost)
   - No error - clearance allows losses
   
3. **Checkout:**
   - Shows 🔴 CLEARANCE badge
   - Completes successfully
   
4. **Loss Tracking:**
   - Open Clearance Report
   - See item: ₹1,200 cost → ₹900 sold = ₹300 loss (25%)
   - Recovery rate: 75%

### Workflow 3: Mixed Bill

**Scenario:** Customer buys festival item + regular item

1. **Scanning:**
   - Scan festival item → Green background
   - Scan regular item → White background
   - Cart shows both

2. **Checkout:**
   - Sale Items section shows: 🟢 FESTIVAL Kurti • ₹1,200
   - Regular items included in totals
   - Complete sale

3. **Reporting:**
   - Sales page → Filter: "Mixed"
   - Bill shows dots: 🟢 + (no dot for regular)
   - CSV export: Festival Items: 1, Regular Items: 1

---

## Troubleshooting

### Issue: "Festival item price is below minimum margin"

**Cause:** Trying to sell festival item below minimum allowed price

**Solution:**
- Check item details: Cost ₹X, Min margin Y%
- Minimum price = Cost × (1 + Y/100)
- Either:
  1. Increase selling price to meet minimum
  2. Change sale type to "Clearance" (removes protection)
  3. Ask admin to lower min margin % for that lot

### Issue: Sale type not saving to database

**Symptom:** Items marked as festival in POS show as "regular" in reports

**Cause:** TypeScript interface missing sale fields (fixed in v1.2)

**Verification:**
- Check CheckoutDialog console logs
- Look for `soldOnSale` and `saleType` in sent data
- Verify Edge Function deployment

**Solution:**
- Ensure Edge Function redeployed: `npx supabase functions deploy complete-sale`
- Check `src/lib/api/sales.ts` CompleteSaleRequest interface

### Issue: Can't see sale badges in cart

**Symptom:** Sale items not showing colored backgrounds

**Cause:** Item not properly marked, or UI not detecting sale fields

**Debugging:**
1. Check lot data - is `sale_type` set in database?
2. Verify cart item has `soldOnSale: true`
3. Check `saleType` field value
4. Inspect CartList.tsx conditional styling

### Issue: Reports showing no data

**Symptom:** Festival/Clearance reports empty despite sales

**Cause:** Filters not matching data, or no sales of that type yet

**Verification:**
- Check Sales page → Filter by type → See any results?
- Open browser console → Check for query errors
- Verify `sold_on_sale=true` and `sale_type` in database:
  ```sql
  SELECT * FROM sale_items WHERE sold_on_sale = true;
  ```

---

## Next Steps

### For Staff Training

1. Practice marking items in POS
2. Test each sale type (festival, clearance, promotion)
3. Understand margin protection errors
4. Review reports to track performance

### For Admins

1. Plan upcoming festivals and set margin %
2. Review festival reports weekly
3. Analyze clearance losses monthly
4. Adjust pricing strategies based on data

### Feature Enhancements (Future)

- [ ] Automatic festival reminders
- [ ] Profit margin calculation (pending Supabase fix)
- [ ] Receipt customization with sale badges
- [ ] PDF export of reports
- [ ] Email alerts for margin violations
- [ ] Multi-tier discounts (10% off 1, 20% off 2)

---

## Quick Reference

### Sale Type Colors

| Sale Type  | Color | Emoji | Background    |
|------------|-------|-------|---------------|
| Festival   | Green | 🟢    | `bg-green-50` |
| Clearance  | Red   | 🔴    | `bg-red-50`   |
| Promotion  | Blue  | 🔵    | `bg-blue-50`  |
| Regular    | None  | -     | `bg-white`    |

### Key Database Fields

**lots table:**
- `sale_type`: 'festival' | 'clearance' | 'promotion' | null
- `min_margin_percent`: decimal (e.g., 20.00)
- `sale_reason`: text (e.g., "Diwali 2024")

**sale_items table:**
- `sold_on_sale`: boolean (true/false)
- `sale_type`: 'festival' | 'clearance' | 'promotion' | null

### Report URLs

- Main Sales: `/admin/sales`
- Festival Report: `/admin/reports/festival`
- Clearance Report: `/admin/reports/clearance`

---

**Version:** 1.0  
**Last Updated:** December 2024  
**Maintained By:** Womaniya Tech Team
