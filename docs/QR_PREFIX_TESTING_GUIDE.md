# QR Prefix Testing Guide

**Status**: Ready for Testing  
**Last Updated**: January 10, 2026  
**Feature**: QR Prefix Management

## Overview

This document provides comprehensive test cases for the QR Prefix feature implementation. Execute these tests systematically to ensure all functionality works correctly.

---

## Pre-Testing Setup

### Required Test Data

1. **Test Prefixes**:
   - `WA-499` (Description: "Regular items ₹499")
   - `WA-TP-599` (Description: "Two-piece items ₹599")
   - `WA-999` (Description: "Premium items ₹999")

2. **Test Categories**: Ensure you have at least 2-3 product categories
3. **Clean State**: Start with no or minimal existing QR codes

---

## Test Suite 1: Database & Functions

### Test 1.1: QR Prefix CRUD Operations

**Create Prefix**
- [ ] Navigate to Settings > QR Prefixes
- [ ] Click "Add" button
- [ ] Enter prefix: `WA-499`
- [ ] Enter description: "Regular items ₹499"
- [ ] Click Save
- [ ] **Expected**: Prefix created successfully, appears in table with Active status

**Validation Tests**
- [ ] Try creating prefix `wa-499` (lowercase)
  - **Expected**: Auto-converts to uppercase `WA-499`, or validation error
- [ ] Try creating prefix `WA499` (no hyphen)
  - **Expected**: Validation error "Must contain at least one hyphen"
  observation:  Invalid prefix format. Use uppercase alphanumeric with hyphens (e.g., WA-499, WA-TP-599)

- [ ] Try creating duplicate `WA-499`
  - **Expected**: Error "Prefix already exists"
- [ ] Try creating prefix `WA-TP-599` (multiple hyphens)
  - **Expected**: Success - multi-segment prefixes are supported

**Edit Prefix**
- [ ] Click Edit icon on `WA-499`
- [ ] Change description to "Updated description"
- [ ] Click Save
- [ ] **Expected**: Description updates successfully

**Toggle Active Status**
- [ ] Click toggle button for `WA-499`
- [ ] **Expected**: Status changes to Inactive, toggle icon updates
- [ ] Click toggle again
- [ ] **Expected**: Status returns to Active

**Delete Prefix**
- [ ] Create temporary prefix `TEST-123`
- [ ] Click Delete icon
- [ ] Confirm deletion
- [ ] **Expected**: Prefix deleted successfully
- [ ] Try deleting prefix with assigned QR codes
- [ ] **Expected**: Error message preventing deletion

### Test 1.2: QR Code Generation with Prefix

**Basic Generation**
- [ ] Navigate to QR Codes page
- [ ] Select prefix: `WA-499`
- [ ] Enter quantity: 10
- [ ] Click Generate
- [ ] **Expected**: 
  - Success message shows "Generated 10 QR codes with prefix WA-499!"
  - Console logs show: "Range: WA-499-0001 to WA-499-0010"
  - Codes appear in table

**Verify Code Format**
- [ ] Check generated codes in table
- [ ] **Expected**: 
  - Format: `WA-499-0001`, `WA-499-0002`, ..., `WA-499-0010`
  - All have status "unused"
  - Sequence numbers are zero-padded (4 digits)

**Sequential Generation**
- [ ] Generate 5 more codes for `WA-499`
- [ ] **Expected**: 
  - New codes: `WA-499-0011` to `WA-499-0015`
  - Sequence continues from previous

**Multiple Prefixes**
- [ ] Select prefix: `WA-TP-599`
- [ ] Generate 10 codes
- [ ] **Expected**: 
  - Codes: `WA-TP-599-0001` to `WA-TP-599-0010`
  - Independent sequence from `WA-499`

**Boundary Testing**
- [ ] Try generating 0 codes
  - **Expected**: Validation error "Quantity must be between 1 and 9999"
- [ ] Try generating 10000 codes
  - **Expected**: Validation error
- [ ] Try generating without selecting prefix
  - **Expected**: Generate button disabled or error

**Sequence Limit**
- [ ] Attempt to generate codes exceeding 9999 limit
  - (Only if you have time to generate 9999+ codes)
  - **Expected**: Error "Sequence limit (9999) would be exceeded"

### Test 1.3: Database Function Verification

**Check in Supabase SQL Editor**

```sql
-- Test 1: Verify prefix stats function
SELECT * FROM get_prefix_qr_stats(
  'YOUR_SHOP_ID_HERE', 
  'PREFIX_ID_HERE'
);
-- Expected: Returns counts (total, unused, assigned, sold, lost)

-- Test 2: Verify unique constraint on (prefix_id, sequence_number)
SELECT prefix_id, sequence_number, COUNT(*) 
FROM qr_codes 
WHERE prefix_id IS NOT NULL
GROUP BY prefix_id, sequence_number 
HAVING COUNT(*) > 1;
-- Expected: No duplicates (empty result)

-- Test 3: Check FK constraint
SELECT COUNT(*) FROM qr_codes 
WHERE prefix_id IS NOT NULL 
AND prefix_id NOT IN (SELECT id FROM qr_prefixes);
-- Expected: 0 (all prefix_ids are valid)
```

---

## Test Suite 2: UI Components

### Test 2.1: Settings Page - QR Prefixes Tab

**Navigation**
- [ ] Go to /admin/settings
- [ ] Click "QR Prefixes" tab
- [ ] **Expected**: Tab switches, shows QR prefixes table

**Table Display**
- [ ] Verify columns: Prefix, Description, Active, Order, Actions
- [ ] Check display order (1, 2, 3...)
- [ ] **Expected**: Prefixes sorted by display_order

**Add Dialog**
- [ ] Click "Add" button
- [ ] **Expected**: Dialog opens with empty form
- [ ] Enter prefix with lowercase: `wa-test`
- [ ] **Expected**: Auto-converts to `WA-TEST` while typing
- [ ] Enter description
- [ ] Click outside dialog
- [ ] **Expected**: Dialog closes, form resets

**Edit Dialog**
- [ ] Click Edit icon
- [ ] **Expected**: Dialog opens, form pre-filled
- [ ] Modify description
- [ ] Click Cancel
- [ ] **Expected**: Changes discarded

**"Generate QR Codes" Button**
- [ ] Click "Generate QR Codes" button in header
- [ ] **Expected**: Redirects to /admin/qr-codes page

**Empty State**
- [ ] Delete all prefixes (or test with new shop)
- [ ] **Expected**: Shows "No QR prefixes found" message

### Test 2.2: QR Codes Page

**Prefix Selector**
- [ ] Navigate to /admin/qr-codes
- [ ] **Expected**: Prefix dropdown shows all active prefixes
- [ ] Select different prefix
- [ ] **Expected**: Preview text updates with selected prefix

**Generation Form**
- [ ] Verify quantity input accepts 1-9999
- [ ] **Expected**: Min/max validation works
- [ ] Click Generate without selecting prefix
- [ ] **Expected**: Button disabled or error message

**Success Message**
- [ ] Generate 50 codes
- [ ] **Expected**: 
  - Toast message: "Generated 50 QR codes with prefix WA-499!"
  - Description: "Range: WA-499-XXXX to WA-499-YYYY"
  - Duration: 4 seconds

**Empty State (No Prefixes)**
- [ ] Deactivate all prefixes in Settings
- [ ] Return to QR Codes page
- [ ] **Expected**: 
  - Shows "No active QR prefixes found" message
  - Button to "Go to Settings"

**Table & Pagination**
- [ ] Generate 100+ codes
- [ ] **Expected**: Pagination works correctly
- [ ] Search for specific code
- [ ] **Expected**: Filters correctly
- [ ] Filter by status
- [ ] **Expected**: Shows only selected status

### Test 2.3: Add Stock Lot Page

**Prefix Selector**
- [ ] Navigate to /admin/inventory/add-lot
- [ ] **Expected**: Prefix selector appears after category field
- [ ] Select prefix
- [ ] **Expected**: Shows "Available QR codes: X"

**Real-time QR Count**
- [ ] Change prefix selection
- [ ] **Expected**: Available count updates immediately
- [ ] Generate more codes, return to form
- [ ] **Expected**: Count increases

**Validation**
- [ ] Select prefix with 5 available codes
- [ ] Enter quantity: 10
- [ ] Try to submit
- [ ] **Expected**: 
  - Error: "Not enough QR codes. Only 5 available for this prefix"
  - Link to generate more codes

**Form Submission**
- [ ] Fill all required fields
- [ ] Select prefix with sufficient codes
- [ ] Submit form
- [ ] **Expected**: 
  - Success message: "Successfully added X items to inventory"
  - Description: "Lot ID: XXX | QR Codes assigned: X"
  - Duration: 4 seconds

**Helper Text**
- [ ] Check helper text below prefix selector
- [ ] **Expected**: Shows "Ensure selling price aligns with prefix for consistency"

---

## Test Suite 3: Integration Tests

### Test 3.1: Complete Workflow

**Scenario**: Create prefix → Generate codes → Add stock lot

1. **Setup**
   - [ ] Create prefix `WA-699` (Description: "Test workflow ₹699")
   - [ ] **Expected**: Prefix created

2. **Generate QR Codes**
   - [ ] Generate 20 codes for `WA-699`
   - [ ] **Expected**: Codes `WA-699-0001` to `WA-699-0020` created
   - [ ] Verify codes appear in table with "unused" status

3. **Add Stock Lot**
   - [ ] Go to Add Stock Lot
   - [ ] Fill form:
     - Category: Any
     - Item Name: "Test Item"
     - Cost: 400
     - Selling Price: 699
     - Quantity: 15
     - Prefix: `WA-699`
   - [ ] Submit form
   - [ ] **Expected**: 
     - Success message shows "15 items"
     - Lot created in inventory

4. **Verify QR Code Status Change**
   - [ ] Go to QR Codes page
   - [ ] Filter by "assigned" status
   - [ ] **Expected**: 15 codes (WA-699-0001 to WA-699-0015) show "assigned"
   - [ ] Remaining 5 codes still "unused"

5. **Check Inventory**
   - [ ] Go to Inventory page
   - [ ] **Expected**: 
     - New lot appears with 15 items
     - Each item has QR code assigned

### Test 3.2: POS Integration

**Scenario**: Scan prefixed QR code at POS

1. **Setup**
   - [ ] Ensure you have items with prefixed QR codes in inventory
   - [ ] Note a specific code (e.g., `WA-699-0001`)

2. **POS Scan**
   - [ ] Go to POS page
   - [ ] Click "Scan QR Code" button
   - [ ] Enter the QR code manually
   - [ ] **Expected**: 
     - Item loads correctly
     - Item details displayed (name, price, etc.)
     - Can add to cart

3. **Complete Sale**
   - [ ] Add item to cart
   - [ ] Complete checkout
   - [ ] **Expected**: 
     - Sale completes successfully
     - Receipt generated

4. **Verify QR Code Status**
   - [ ] Go to QR Codes page
   - [ ] Search for the sold code
   - [ ] **Expected**: Status changed to "sold"
   - [ ] Click "View details"
   - [ ] **Expected**: Shows sale information

### Test 3.3: Multi-Prefix Workflow

**Scenario**: Work with multiple prefixes simultaneously

1. **Create Multiple Prefixes**
   - [ ] Create 3 prefixes: `WA-499`, `WA-699`, `WA-999`
   - [ ] Generate 10 codes for each
   - [ ] **Expected**: 30 total codes with independent sequences

2. **Add Stock Lots for Each Prefix**
   - [ ] Create lot 1: 5 items, prefix `WA-499`, price ₹499
   - [ ] Create lot 2: 5 items, prefix `WA-699`, price ₹699
   - [ ] Create lot 3: 5 items, prefix `WA-999`, price ₹999
   - [ ] **Expected**: Each lot uses correct prefix codes

3. **Verify Code Assignment**
   - [ ] Go to QR Codes page
   - [ ] Check codes for each prefix
   - [ ] **Expected**: 
     - `WA-499-0001` to `WA-499-0005`: assigned
     - `WA-699-0001` to `WA-699-0005`: assigned
     - `WA-999-0001` to `WA-999-0005`: assigned
     - Remaining codes: unused

4. **Delete Unused Codes by Prefix**
   - [ ] Filter unused codes
   - [ ] Select remaining codes for `WA-499`
   - [ ] Bulk delete
   - [ ] **Expected**: Only `WA-499` unused codes deleted

---

## Test Suite 4: Edge Cases & Error Handling

### Test 4.1: Prefix Management Edge Cases

**Inactive Prefix Behavior**
- [ ] Deactivate prefix `WA-499`
- [ ] Try to generate codes for `WA-499`
- [ ] **Expected**: Prefix not in dropdown (only active prefixes shown)
- [ ] Try to add stock lot with inactive prefix
- [ ] **Expected**: Prefix not in dropdown

**Delete Prefix with Codes**
- [ ] Try to delete prefix that has QR codes
- [ ] **Expected**: Error "Cannot delete prefix with existing QR codes"

**Reactivate Prefix**
- [ ] Reactivate previously deactivated prefix
- [ ] **Expected**: 
  - Appears in dropdowns again
  - Sequence continues from last number

**Display Order Edge Cases**
- [ ] Delete middle prefix (e.g., order 2 of 5)
- [ ] **Expected**: Other prefixes retain their order
- [ ] Add new prefix
- [ ] **Expected**: Gets next available order number

### Test 4.2: QR Code Generation Edge Cases

**Concurrent Generation**
- [ ] Open two browser tabs
- [ ] Generate codes for same prefix in both
- [ ] **Expected**: No duplicate sequences (database handles uniqueness)

**Network Error Simulation**
- [ ] Start generation, disconnect network
- [ ] **Expected**: Error message displayed
- [ ] Reconnect and retry
- [ ] **Expected**: Generation succeeds

**Large Batch Generation**
- [ ] Generate 1000 codes at once
- [ ] **Expected**: 
  - Completes without timeout
  - All codes generated correctly
  - No performance issues

### Test 4.3: Stock Lot Edge Cases

**Exact QR Match**
- [ ] Prefix has exactly 10 unused codes
- [ ] Create lot with quantity 10
- [ ] **Expected**: Success, all codes assigned

**Insufficient Codes**
- [ ] Prefix has 5 unused codes
- [ ] Try to create lot with quantity 10
- [ ] **Expected**: 
  - Clear error message
  - Link to generate more codes
  - Form does not submit

**Empty Prefix**
- [ ] Use all codes from a prefix
- [ ] Try to create lot with that prefix
- [ ] **Expected**: 
  - Shows "0 available"
  - Validation prevents submission

---

## Test Suite 5: Performance & Scalability

### Test 5.1: Large Dataset Performance

**1000+ QR Codes**
- [ ] Generate 1000 codes across multiple prefixes
- [ ] Navigate to QR Codes page
- [ ] **Expected**: 
  - Page loads in < 2 seconds
  - Pagination works smoothly
  - Search is responsive

**Bulk Operations**
- [ ] Select 100 unused codes
- [ ] Bulk delete
- [ ] **Expected**: 
  - Completes in < 5 seconds
  - No browser freeze

### Test 5.2: Browser Compatibility

- [ ] Test on Chrome
- [ ] Test on Firefox
- [ ] Test on Edge
- [ ] Test on Safari (if available)
- [ ] **Expected**: Consistent behavior across all browsers

### Test 5.3: Mobile Responsiveness

- [ ] Test Settings page on mobile
- [ ] **Expected**: 
  - Tables scroll horizontally
  - Dialogs fit screen
  - Buttons are tappable

- [ ] Test QR Codes page on mobile
- [ ] **Expected**: 
  - Generation form stacks vertically 
  - Table is scrollable
  - Pagination works

- [ ] Test Add Stock Lot on mobile
- [ ] **Expected**: 
  - Form fields stack properly
  - Prefix selector is usable

---

## Test Suite 6: Security & Permissions

### Test 6.1: RLS Policy Verification

**Shop Isolation**
- [ ] Create prefixes in Shop A
- [ ] Log in to Shop B
- [ ] **Expected**: Cannot see Shop A's prefixes
- [ ] Try to access Shop A's prefix ID directly
- [ ] **Expected**: Access denied

**QR Code Isolation**
- [ ] Generate codes in Shop A
- [ ] Try to view from Shop B
- [ ] **Expected**: Codes not visible

### Test 6.2: Role-Based Access

**Admin Access**
- [ ] Log in as admin
- [ ] **Expected**: Full access to all prefix features

**Staff Access** (if different from admin)
- [ ] Log in as staff
- [ ] Try to access Settings > QR Prefixes
- [ ] **Expected**: Based on your permission model

---

## Regression Testing Checklist

After completing all tests above, verify existing features still work:

- [ ] Add inventory without QR codes (legacy flow)
- [ ] POS: Add items manually (non-QR)
- [ ] Complete sale without QR scanning
- [ ] View sales history
- [ ] Export data (inventory, sales, QR codes)
- [ ] Settings: Other tabs still functional

---

## Test Results Summary

**Date Tested**: _________________  
**Tested By**: _________________  
**Environment**: _________________

### Results

| Test Suite | Tests Passed | Tests Failed | Notes |
|------------|--------------|--------------|-------|
| 1. Database & Functions | __ / __ | __ / __ | |
| 2. UI Components | __ / __ | __ / __ | |
| 3. Integration Tests | __ / __ | __ / __ | |
| 4. Edge Cases | __ / __ | __ / __ | |
| 5. Performance | __ / __ | __ / __ | |
| 6. Security | __ / __ | __ / __ | |
| **TOTAL** | **__ / __** | **__ / __** | |

### Critical Issues Found

1. 
2. 
3. 

### Minor Issues Found

1. 
2. 
3. 

### Recommendations

1. 
2. 
3. 

---

## Sign-Off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Documentation reviewed
- [ ] Ready for production deployment

**Approved By**: _________________  
**Date**: _________________
