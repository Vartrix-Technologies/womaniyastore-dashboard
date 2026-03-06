# QR Prefix User Guide

**For**: Womaniya Dashboard Users (Admin/Staff)  
**Last Updated**: January 10, 2026  
**Feature**: QR Prefix Management

---

## Table of Contents

1. [What are QR Prefixes?](#what-are-qr-prefixes)
2. [Why Use QR Prefixes?](#why-use-qr-prefixes)
3. [Getting Started](#getting-started)
4. [Managing QR Prefixes](#managing-qr-prefixes)
5. [Generating QR Codes](#generating-qr-codes)
6. [Adding Inventory with Prefixes](#adding-inventory-with-prefixes)
7. [Best Practices](#best-practices)
8. [Frequently Asked Questions](#frequently-asked-questions)
9. [Troubleshooting](#troubleshooting)

---

## What are QR Prefixes?

QR Prefixes are custom labels that organize your QR codes into meaningful groups. Each prefix generates QR codes in a structured format:

**Format**: `PREFIX-0001`, `PREFIX-0002`, `PREFIX-0003`, etc.

**Examples**:
- `WA-499-0001`, `WA-499-0002` → Items priced at ₹499
- `WA-TP-599-0001`, `WA-TP-599-0002` → Two-piece items at ₹599
- `WA-999-0001`, `WA-999-0002` → Premium items at ₹999

Each prefix maintains its own independent sequence numbering from 0001 to 9999.

---

## Why Use QR Prefixes?

### Benefits

1. **Price-Based Organization**
   - Instantly identify item price from QR code
   - Example: All `WA-499-*` codes = ₹499 items

2. **Product Line Separation**
   - Group by product type (e.g., `WA-TP-*` for two-piece items)
   - Separate regular from premium collections

3. **Better Inventory Control**
   - Track stock by price range
   - Know available codes per category at a glance

4. **Simplified POS Operations**
   - Staff can verify prices by QR prefix
   - Reduces pricing errors

5. **Professional Appearance**
   - Structured, consistent code format
   - Easy to read and remember

---

## Getting Started

### Prerequisites

Before using QR prefixes, you need:
- Admin access to the dashboard
- At least one product category created
- Understanding of your pricing structure

### Quick Start (5 Minutes)

1. **Create Your First Prefix**
   - Go to: **Settings → QR Prefixes**
   - Click "Add"
   - Enter: `WA-499` (Prefix) and "Regular items ₹499" (Description)
   - Save

2. **Generate QR Codes**
   - Go to: **QR Codes** page
   - Select prefix: `WA-499`
   - Enter quantity: 100
   - Click "Generate"

3. **Add Inventory**
   - Go to: **Inventory → Add Stock Lot**
   - Fill in item details
   - Select prefix: `WA-499`
   - Ensure selling price is ₹499
   - Submit

You're done! Your items now have organized QR codes.

---

## Managing QR Prefixes

### Accessing QR Prefix Settings

1. Click **Settings** in the sidebar
2. Click the **QR Prefixes** tab
3. You'll see a table of all your prefixes

### Creating a New Prefix

**Step-by-Step**:

1. Click the **"Add"** button
2. **Enter Prefix** (Required):
   - Format: UPPERCASE letters and numbers with hyphens
   - Examples: `WA-499`, `WA-TP-599`, `WA-PREMIUM`
   - Must contain at least one hyphen
   - Maximum length: 20 characters

3. **Enter Description** (Required):
   - Helpful reminder of what this prefix is for
   - Examples: "Regular items ₹499", "Two-piece ₹599"
   - Maximum length: 200 characters

4. Click **"Save"**

**Naming Guidelines**:

✅ **Good Prefix Names**:
- `WA-499` → Clear, indicates ₹499 items
- `WA-TP-599` → Two-piece items at ₹599
- `WA-SALE` → Sale items
- `WA-999` → Premium ₹999 items

❌ **Avoid**:
- `wa-499` → Will auto-correct to uppercase
- `WA499` → Missing hyphen (validation error)
- `PREFIX123456789012345` → Too long
- Special characters like `WA-499!` → Not allowed

### Editing a Prefix

1. Find the prefix in the table
2. Click the **Edit** icon (pencil)
3. Update the description (prefix cannot be changed)
4. Click "Save"

**Note**: You cannot change the prefix name itself to maintain data integrity. If you need a different prefix, create a new one.

### Activating/Deactivating a Prefix

**To Deactivate**:
1. Find the prefix in the table
2. Click the **Toggle** button (shows as active/green)
3. Confirm if prompted

**When Deactivated**:
- Prefix won't appear in QR generation dropdown
- Won't appear in stock lot creation dropdown
- Existing QR codes remain unchanged
- Can be reactivated anytime

**When to Deactivate**:
- Discontinued price point
- Seasonal prefix no longer needed
- Temporary pause on generating codes for this prefix

**To Reactivate**:
- Click the toggle button again
- Prefix immediately available for use

### Deleting a Prefix

1. Find the prefix in the table
2. Click the **Delete** icon (trash can)
3. Confirm deletion

**Important Restrictions**:
- ⚠️ You **cannot delete** a prefix that has QR codes
- Must first delete all QR codes associated with that prefix
- This prevents accidental data loss

**If you need to remove a prefix with codes**:
1. Deactivate it instead (recommended), OR
2. Delete all unused QR codes for that prefix first
3. Then delete the prefix

### Display Order

Prefixes are automatically ordered by when they were created. The display order determines:
- Order in dropdown menus
- Order in the settings table
- No manual reordering needed (automatic)

### Quick Actions

**Generate QR Codes Button**:
- Located in the QR Prefixes tab header
- Click to quickly jump to QR code generation page
- Saves time when you need to generate codes immediately after creating a prefix

---

## Generating QR Codes

### Accessing QR Code Generation

**Two Ways**:
1. Directly: **QR Codes** page from sidebar
2. From Settings: Click **"Generate QR Codes"** button in QR Prefixes tab

### Generation Process

1. **Select Prefix** (Required)
   - Dropdown shows all active prefixes
   - Shows prefix name and description
   - Example: `WA-499 (Regular items ₹499)`

2. **Enter Quantity** (Required)
   - Minimum: 1 code
   - Maximum: 9999 codes per batch
   - Each prefix can have up to 9999 total codes

3. **Preview**
   - Below the form, see preview:
   - "Codes will be generated as WA-499-0001, WA-499-0002, ..."

4. **Click "Generate"**
   - Progress indicator shows during generation
   - Success message displays range:
   - "Generated 100 QR codes with prefix WA-499!"
   - "Range: WA-499-0001 to WA-499-0100"

### Understanding Sequences

**How Sequencing Works**:
- Each prefix maintains its own sequence
- Sequences start at 0001
- Numbers are zero-padded to 4 digits
- Maximum sequence: 9999

**Example**:

If you have:
- Prefix `WA-499` with codes 0001-0050 already generated
- Prefix `WA-699` with codes 0001-0100 already generated

When you generate:
- 10 more codes for `WA-499` → Creates 0051-0060 (continues from 50)
- 10 more codes for `WA-699` → Creates 0101-0110 (continues from 100)

Each prefix is independent!

### How Many Codes Should You Generate?

**Guidelines**:

| Stock Size | Recommended Quantity |
|------------|---------------------|
| Small stock (< 50 items) | Generate 50-100 codes |
| Medium stock (50-200 items) | Generate 200-300 codes |
| Large stock (200+ items) | Generate 500+ codes |

**Tips**:
- Generate codes in advance to have them ready
- Better to have extra than run out during stock addition
- Unused codes don't cost anything
- Can always generate more when needed

### Success Indicators

After successful generation:
1. ✅ Success toast message with code range
2. 🔄 Page automatically shows newest codes
3. 📊 Stats update (Total Codes, Unused counts)
4. 👀 New codes appear in table with "unused" status

### Viewing Generated Codes

**QR Codes Table**:
- Shows all your QR codes
- **Columns**: Code, Status, Created Date, Actions
- **Statuses**:
  - 🟢 **Unused** → Available for assignment
  - 🔵 **Assigned** → Attached to inventory items
  - 🟣 **Sold** → Item has been sold
  - 🔴 **Lost** → Marked as lost/damaged

**Filters**:
- Click status tabs to filter: All, Unused, Assigned, Sold, Lost
- Use search box to find specific codes
- Use pagination for large lists

---

## Adding Inventory with Prefixes

### Stock Lot Creation with QR Prefix

When adding a new stock lot, you now select a QR prefix for proper organization.

**Process**:

1. Go to **Inventory → Add Stock Lot**

2. Fill in **Basic Details**:
   - Item Name
   - Category
   - Cost Price
   - Selling Price

3. **Select QR Prefix** (New Field):
   - Dropdown appears below Category
   - Shows only active prefixes
   - Displays available unused codes for each prefix
   - Example: `WA-499 (50 available)`

4. **Real-Time Availability**:
   - As you change prefix, available count updates
   - Helps you choose prefix with sufficient codes
   - Shows: "Available QR codes: 50"

5. **Enter Quantity**:
   - System validates against available codes
   - If quantity > available: Error message with link to generate more
   - Must have enough unused codes

6. **Submit**:
   - QR codes automatically assigned
   - Success message shows:
     - "Successfully added 20 items to inventory"
     - "Lot ID: XXX | QR Codes assigned: 20"
   - Codes change from "unused" to "assigned" status

### Prefix-Price Alignment

**Important**: Ensure your selling price matches the prefix logic.

✅ **Correct Alignment**:
- Prefix: `WA-499` → Selling Price: ₹499
- Prefix: `WA-TP-599` → Selling Price: ₹599
- Prefix: `WA-999` → Selling Price: ₹999

⚠️ **Misalignment** (system allows but not recommended):
- Prefix: `WA-499` → Selling Price: ₹699 ❌ Confusing!

**Helper Text**: The form shows a reminder:
> "Ensure selling price aligns with prefix for consistency"

### What If I Run Out of Codes?

**Scenario**: You select `WA-499` but only 5 codes available, and you need 20.

**System Response**:
1. Shows validation error
2. Message: "Not enough QR codes. Only 5 available for prefix WA-499"
3. Provides link: "Generate more QR codes"

**Solution**:
1. Click the "Generate more QR codes" link
2. Generates additional codes for that prefix
3. Return to stock lot form
4. Submit successfully

---

## Best Practices

### Prefix Naming Strategy

**Recommended Format**: `BRAND-PRICE` or `BRAND-TYPE-PRICE`

**Examples for Womaniya**:
- `WA-399` → Regular items ₹399
- `WA-499` → Regular items ₹499
- `WA-599` → Regular items ₹599
- `WA-TP-599` → Two-piece items ₹599
- `WA-TP-799` → Two-piece items ₹799
- `WA-PREMIUM` → High-end collection
- `WA-SALE` → Sale/clearance items

### Code Generation Strategy

**Pre-Generate Codes**:
- Don't wait until you need them
- Generate codes in advance during quiet times
- Recommended buffer: Always keep 100+ unused codes per active prefix

**Batch Sizes**:
- Small daily stock: Generate 50-100 at a time
- Weekly stock: Generate 200-500 at a time
- Monthly planning: Generate 500-1000 at a time

### Inventory Organization

**Price-Based Prefixes**:
```
WA-399: Entry-level items
WA-499: Mid-range regular items
WA-599: Higher regular items
WA-TP-599: Two-piece mid-range
WA-999: Premium items
```

**Type-Based Prefixes**:
```
WA-SAREE: All sarees
WA-SUIT: All suits
WA-LEHENGA: All lehengas
WA-DUPATTA: All dupattas
```

Choose one strategy and stick to it for consistency.

### Maintenance

**Regular Tasks**:

1. **Weekly**:
   - Check unused code counts for active prefixes
   - Generate more if any prefix has < 50 unused codes
   - Review any inactive prefixes

2. **Monthly**:
   - Audit prefix usage
   - Deactivate unused prefixes
   - Clean up old unused codes (if needed)

3. **Quarterly**:
   - Review naming consistency
   - Update descriptions if needed
   - Plan new prefixes for upcoming seasons

### Staff Training

**What Staff Need to Know**:

1. **POS Staff**:
   - QR codes now have prefixes (WA-499-0001)
   - Prefix indicates expected price (WA-499 = ₹499)
   - Scan process remains the same

2. **Inventory Staff**:
   - Must select correct prefix when adding stock
   - Match prefix with selling price
   - Check available codes before bulk entry

3. **Admin/Management**:
   - Create new prefixes as needed
   - Maintain adequate unused code supply
   - Monitor prefix usage patterns

---

## Frequently Asked Questions

### General Questions

**Q: Can I change a prefix name after creating it?**  
A: No, prefix names are permanent to maintain data integrity. Create a new prefix if you need a different name.

**Q: What happens to existing QR codes without prefixes?**  
A: They remain functional. The system supports both legacy (no prefix) and new (prefixed) codes.

**Q: How many prefixes can I create?**  
A: No hard limit, but recommended to keep it manageable (5-10 active prefixes).

**Q: Can two prefixes have the same sequence number?**  
A: Yes! Each prefix has its own independent sequence. `WA-499-0001` and `WA-699-0001` can both exist.

### Code Generation

**Q: What if I generate codes but don't use them?**  
A: Unused codes don't cause any issues. They stay in "unused" status until assigned or deleted.

**Q: Can I delete unused codes?**  
A: Yes, you can delete individual codes or bulk delete unused codes from the QR Codes page.

**Q: What happens when I reach 9999 codes for a prefix?**  
A: System prevents generating more. Consider creating a new prefix (e.g., `WA-499-A`, `WA-499-B`).

**Q: Can I generate codes for an inactive prefix?**  
A: No, only active prefixes appear in the generation dropdown. Reactivate the prefix first.

### Inventory Integration

**Q: What if I select the wrong prefix for a stock lot?**  
A: Currently, you cannot change QR assignments after creation. Be careful when selecting. (Consider adding an edit feature in the future.)

**Q: Can one item have multiple QR codes?**  
A: No, each QR code is unique and assigned to one item only.

**Q: What if I don't have enough QR codes when adding stock?**  
A: The system will show an error with a link to generate more codes. Generate codes first, then return to complete stock addition.

### POS & Sales

**Q: Do prefixed QR codes work differently at POS?**  
A: No, scanning works exactly the same. The prefix is just part of the code.

**Q: Can customers see the QR prefix?**  
A: If you print QR codes on tags, yes they can see it. It's not sensitive information.

**Q: What happens to the QR code after a sale?**  
A: Status changes from "assigned" → "sold". Code cannot be reused.

---

## Troubleshooting

### Problem: "No active QR prefixes found" on QR Codes page

**Cause**: No prefixes created or all prefixes are inactive.

**Solution**:
1. Go to Settings → QR Prefixes
2. Create a new prefix, OR
3. Activate an existing prefix (toggle button)

---

### Problem: "Validation error: Must contain at least one hyphen"

**Cause**: Prefix entered without a hyphen (e.g., `WA499`)

**Solution**:
- Format your prefix correctly: `WA-499`
- Must have at least one hyphen
- Can have multiple: `WA-TP-599`

---

### Problem: "Cannot delete prefix with existing QR codes"

**Cause**: Trying to delete a prefix that has generated QR codes.

**Solution**:
1. **Recommended**: Deactivate the prefix instead (safer)
2. **Alternative**: Delete all QR codes for this prefix first
   - Go to QR Codes page
   - Filter by prefix (use search)
   - Delete unused codes
   - Note: Cannot delete assigned/sold codes

---

### Problem: "Not enough QR codes available"

**Cause**: Stock lot quantity exceeds available unused codes for selected prefix.

**Solution**:
1. Click "Generate more QR codes" link in error message
2. Select the same prefix
3. Generate sufficient quantity
4. Return to stock lot form
5. Retry submission

---

### Problem: Prefix dropdown is empty when adding stock

**Cause**: No active prefixes, or all prefixes have 0 unused codes.

**Solution**:
1. Check Settings → QR Prefixes (ensure active prefixes exist)
2. Go to QR Codes page
3. Generate codes for the desired prefix
4. Return to stock lot form

---

### Problem: QR code sequence numbers are not consecutive

**Cause**: Some codes were deleted, creating gaps.

**Solution**:
- This is normal and doesn't cause issues
- System tracks sequence internally
- Gaps don't affect functionality
- New codes continue from highest sequence number

---

### Problem: Success message doesn't show QR code range

**Cause**: Browser console may show additional details.

**Current Behavior**:
- Success toast shows: "Generated X QR codes with prefix XXX!"
- Description should show: "Range: WA-499-0001 to WA-499-0100"

**Solution**:
- Check browser console (F12) for detailed logs
- If range not showing, it's a UI display issue (functionality still works)
- Check the QR Codes table to verify codes were generated correctly

---

## Getting Help

### Support Resources

1. **In-App Help**:
   - Look for tooltip icons (ℹ️) next to form fields
   - Read helper text below input fields

2. **Documentation**:
   - This User Guide
   - QR Prefix Testing Guide (for technical team)
   - Product Requirements Document

3. **Technical Support**:
   - Contact your system administrator
   - Provide error screenshots
   - Note which steps you've already tried

### Reporting Issues

When reporting problems, include:
1. **What you were trying to do**
2. **What happened instead**
3. **Screenshots** (especially error messages)
4. **Browser and device** you're using
5. **Steps to reproduce** the issue

---

## Glossary

| Term | Definition |
|------|------------|
| **QR Prefix** | A custom label that organizes QR codes into groups (e.g., WA-499) |
| **Sequence Number** | The numeric part of a QR code (0001-9999) |
| **Unused Code** | Generated QR code not yet assigned to any inventory item |
| **Assigned Code** | QR code attached to an inventory item |
| **Sold Code** | QR code for an item that has been sold |
| **Active Prefix** | Prefix available for use in dropdowns and generation |
| **Inactive Prefix** | Prefix hidden from dropdowns but existing codes remain valid |
| **Stock Lot** | A batch of inventory items added together with sequential QR codes |

---

## Appendix: Quick Reference Card

### Common Tasks

| Task | Steps |
|------|-------|
| Create prefix | Settings → QR Prefixes → Add → Enter prefix + description → Save |
| Generate codes | QR Codes → Select prefix → Enter quantity → Generate |
| Add inventory | Add Stock Lot → Fill form → Select prefix → Enter quantity → Submit |
| Deactivate prefix | Settings → QR Prefixes → Click toggle button |
| Delete unused codes | QR Codes → Select codes → Delete Selected |

### Keyboard Shortcuts (QR Codes Page)

| Key | Action |
|-----|--------|
| ← (Left Arrow) | Previous page |
| → (Right Arrow) | Next page |

### Status Color Guide

- 🟢 **Green (Unused)**: Available for assignment
- 🔵 **Blue (Assigned)**: In inventory
- 🟣 **Purple (Sold)**: Sold to customer
- 🔴 **Red (Lost)**: Marked as lost/damaged

---

**Document Version**: 1.0  
**Last Updated**: January 10, 2026  
**For Questions**: Contact your system administrator
