# Inventory Module Test Plan (API-focused)

This document captures the remaining high-priority tests to implement. Use `jest + supertest` (or your preferred runner) and target `/api/v1` routes with org-scoped authenticated users.

## 1) Global Search
- Returns results for multiple entity types; respects `type` filter and pagination.
- Org scoping: user from org A cannot see org B data.
- Error isolation: if one entity search fails, others still return (safeRun behavior).
- Field validation: `purchase_requests.requested_date` and `stock_transfers.remarks` searchable; users are not returned.

## 2) Purchase Requests (PR)
- Create PR (org-scoped user) -> status DRAFT.
- Submit, approve, reject transitions; forbidden when already terminal.
- List/filter by status/date; org scoping blocks cross-org access.
- PR -> PO linkage retained on create.

## 3) Purchase Orders (PO)
- Create PO (with/without PR link) in org; status DRAFT.
- Send -> status SENT; Receive -> status RECEIVED; blocked if invalid sequence.
- List/filter by status/vendor; org scoping blocks cross-org access.

## 4) Inward Flow
- Create inward entry -> status DRAFT; no inventory rows yet.
- Mark as completed:
  - Creates inventory rows per item/quantity.
  - Blocks duplicate serials.
  - Blocks when status is CANCELLED or already COMPLETED.
- Org scoping on get/list and completion.

## 5) Stock Transfer
- Create transfer: from warehouse to warehouse, and to person (with ticket).
- Validates source availability; updates inventory location/status.
- Org scoping on get/list.

## 6) Consumption
- Create consumption from warehouse/person; marks inventory CONSUMED.
- Blocks when insufficient stock or wrong owner.
- Org scoping on get/list.

## 7) Returns
- Create return (technician/person stock); validates ownership.
- Approve -> moves items back to warehouse; status PENDING->APPROVED.
- Reject -> status PENDING->REJECTED.
- Org scoping on get/list.

## 8) Bulk Import
- CSV happy path: creates materials; rejects duplicates with clear errors.
- Validation failures per-row; org scoping applied.

## Test Harness Notes
- Use seeded org/users/fixtures per test run.
- Issue JWT for test users; attach `Authorization: Bearer ...`.
- Consider `NODE_ENV=test` DB schema or transaction-wrapped tests with cleanup.


