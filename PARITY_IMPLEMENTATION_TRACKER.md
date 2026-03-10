# React -> Flutter Parity Tracker

## Scope Compared
- React app: `Ethernet-CRM-pr-executive-management/client`
- Flutter app: `madhuram_app`
- Audit date: March 10, 2026

## Current Route Parity (after Phase 4)
- `done`: `/dashboard`, `/projects`, `/boq`, `/mas`, `/samples`, `/purchase-orders`, `/vendors`, `/challans`, `/mer`, `/mir`, `/itr`, `/billing`, `/documents`, `/reports`, `/audit-logs`, `/profile`, `/inventory/add`
- `done via alias`: `/users` -> `ProfilePage`, `/settings` -> `ProfilePage`, `/inventory` -> `AddInventoryPage`, `/purchase-orders/preview` -> `PurchaseOrdersPageFull`, `/mir/preview` -> `MIRPageFull`, `/itr/preview` -> `ITRPageFull`
- `done (new)`: `/vendors/price-lists`, `/vendors/price-lists/create`, `/vendors/price-lists/view`, `/vendors/view-price` (argument-driven)
- `architecture difference (intentional for now)`: React uses `/:projectId/...`; Flutter uses global selected project state.

## API Parity Status
- `done`: Auth, users, projects, BOQ, samples, PO, MIR, ITR, vendors, inventory, challans, dashboard, notifications, reports, audit logs, compress/upload helpers.
- `done in Phase 1`: `getVendorById`, full vendor-price-list endpoints (`upload`, `list`, `getById`, `create`, `update`, `delete`, `status`).
- `done in Phase 1`: React-named alias methods in Flutter API client (`createPo`, `getMirsByProject`, `getDcsByProject`, etc.) to simplify page-by-page migration mapping.

## Page-by-Page Gap Matrix
- `complete`: Login, Project Selection, Dashboard, Projects, BOQ, Materials, Stock Areas, Add Inventory, Stock Transfers, Consumption, Returns, Purchase Orders, Vendors, Challans, New Challan, Challan Detail, MIR, ITR, Samples, Sample Create/Edit/Preview, Reports, Audit Logs, Billing, Documents, Profile.
- `complete`: Vendor Price Lists + Create + View + View Latest Price pages (functional parity with React for list/create/view/latest flow).
- `partial`: Vendor Comparison (UI is usable with seeded matrix and actions, but no backend comparison endpoint integration yet).
- `pending`: Vendor Comparison backend-connected flow with persisted comparison records and export actions.

## Implementation Phases

### Phase 1 (Completed)
- Added missing API endpoints for vendor price lists in Flutter.
- Added React-compatible API alias method names in Flutter client.
- Added new Flutter page `vendor_price_lists_page.dart`.
- Added navigation from `vendors_page_full.dart` actions:
  - Price Lists
  - View Latest Price
- Added missing route aliases for users/settings/inventory/preview routes.

### Phase 2 (Completed)
- Built dedicated Flutter page: `vendor_price_list_create_page.dart`.
- Wired route: `/vendors/price-lists/create` (argument-driven).
- Added navigation from Vendor Price Lists page to dedicated create page.
- Implemented parity scope:
  - header section and back navigation
  - version/status form
  - file pick + upload flow + filename/file-path fields
  - manual item entry blocks with add/remove/edit
  - create payload with `vendor_id`, `version_name`, `status`, `file_path`, `items`
  - success return to list page and reload

### Phase 3 (Completed)
- Built dedicated Flutter page for `Vendor Price List View` parity:
  - full detail fetch
  - status updates
  - editable fields and save flow

### Phase 4 (Completed)
- Built dedicated Flutter page for `Vendor View Price` parity:
  - fetch vendor + latest list
  - summary cards and key pricing display

### Phase 5 (Next)
- Vendor Comparison backend integration and full UI parity.
- End-to-end QA for project-scoped behavior and role access.

## Validation run in this phase
- Command: `flutter analyze lib/main.dart lib/pages/vendor_view_price_page.dart lib/pages/vendor_comparison_page.dart`
- Result: no issues in changed files.
