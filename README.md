# Madhuram SCM: React + Flutter + Node API (Monorepo Notes)

This workspace contains:
- A **React web app** (`Ethernet-CRM-pr-executive-management/client`)
- A **Node/Express + MySQL (Sequelize) backend** (`Ethernet-CRM-pr-executive-management/server`)
- A **Flutter app** (`madhuram_app`)

It also contains API docs/specs, parity trackers, and migration notes to help keep the React and Flutter clients aligned.

## Repo Layout

### React web app
- Path: `Ethernet-CRM-pr-executive-management/client`
- Stack (from `package.json`): React + Vite + Tailwind + Radix UI + Redux Toolkit + React Router
- Central API wrapper: `Ethernet-CRM-pr-executive-management/client/src/lib/api.js`
- Notable env vars:
  - `VITE_API_BASE_URL` (defaults to `https://api.madhuram.enterprises`)
  - `VITE_DASHBOARD_WS_URL` (optional; used to build websocket URL)

### Backend (Express + Sequelize + MySQL)
- Path: `Ethernet-CRM-pr-executive-management/server`
- Entry: `Ethernet-CRM-pr-executive-management/server/src/server.js`
- Env template: `Ethernet-CRM-pr-executive-management/server/ENV_EXAMPLE.md`
- API docs/specs: `Ethernet-CRM-pr-executive-management/apis/`
- Postman collection: `Ethernet-CRM-pr-executive-management/Ethernet-CRM-Postman-Collection.json`

### Flutter app
- Path: `madhuram_app`
- Central API client: `madhuram_app/lib/services/api_client.dart`
- Base URL configuration:
  - `ApiClient.baseUrl` uses a compile-time define `API_BASE_URL`
  - Default: `https://api.madhuram.enterprises`
  - Example run: `flutter run --dart-define=API_BASE_URL=http://localhost:5000`
- React↔Flutter mapping notes: `madhuram_app/API_MAPPING.md`

## Quickstart (Local Dev)

### 1) Backend
From workspace root:
1. `cd Ethernet-CRM-pr-executive-management/server`
2. Create `.env` using `ENV_EXAMPLE.md` (at minimum: DB + `JWT_SECRET` + `PORT`)
3. Install deps: `npm install`
4. Start: `npm run dev`

Notes:
- `server/src/server.js` uses `PORT || 5000` (the env template shows `3000`; adjust as needed).
- Static uploads are served at `GET /uploads/...` from the backend working directory.

### 2) React web app
1. `cd Ethernet-CRM-pr-executive-management/client`
2. (Optional) set `VITE_API_BASE_URL=http://localhost:5000`
3. `npm install`
4. `npm run dev`

### 3) Flutter app
1. `cd madhuram_app`
2. `flutter pub get`
3. `flutter run --dart-define=API_BASE_URL=http://localhost:5000`

## Backend API (Implemented in `server/src/server.js`)

Base prefixes (mounted in `server/src/server.js`):
- `POST /api/auth/*` (auth + admin user management)
- `POST /api/po/*` (purchase orders + file upload)
- `POST /api/dc/*` (delivery challans + file upload)
- `POST /api/projects/*` + `POST /api/compress` (projects + file compression)
- `POST /api/boq/*` (BOQ + file upload)
- `POST /api/mir/*` (MIR + file upload)
- `POST /api/itr/*` (ITR + file upload)
- `POST /api/sample/*` (samples + multi-file upload)
- `POST /api/inventory/*` (inventory CRUD)
- `POST /api/vendors/*` (vendor CRUD + status patch)
- `POST /api/vendor-price-list/*` (vendor price list CRUD + upload)
- `POST /api/pr/email` (send PR email with attachment)
- `GET /health` (health check)

### Endpoint list (by router file)

Auth (`server/src/routes/authRoutes.js`, mounted at `/api/auth`)
- `POST /signup`
- `POST /login`
- `POST /logout` (auth required)
- `POST /forgot-password`
- `POST /users` (admin only)
- `GET /users` (admin only)
- `GET /users/:id` (admin only)
- `PUT /users/:id` (admin only)
- `PATCH /users/:id/access-control` (admin only)
- `DELETE /users/:id` (admin only)

Projects + compression (`server/src/routes/projectRoutes.js`, mounted at `/api`)
- `POST /projects` (auth required; multipart: `work_order_file`, `mas_file`)
- `GET /projects` (auth required)
- `GET /projects/:id` (auth required)
- `PUT /projects/:id` (auth required; multipart: `work_order_file`, `mas_file`)
- `DELETE /projects/:id` (auth required)
- `POST /compress` (auth required; multipart: `file`)

PO (`server/src/routes/poRoutes.js`, mounted at `/api/po`)
- `POST /upload` (multipart: `file`)
- `POST /`
- `GET /project/:projectId`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`

DC (`server/src/routes/dcRoutes.js`, mounted at `/api/dc`)
- `POST /upload` (multipart: `file`)
- `POST /`
- `GET /project/:projectId`
- `GET /po/:poId`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`

BOQ (`server/src/routes/boqRoutes.js`, mounted at `/api/boq`)
- `POST /` (multipart: `boq_file`)
- `GET /`
- `GET /project/:projectId`
- `GET /:id`
- `PUT /:id` (multipart: `boq_file`)
- `DELETE /:id`

MIR (`server/src/routes/mirRoutes.js`, mounted at `/api/mir`)
- `POST /upload` (multipart: `file`)
- `POST /`
- `GET /`
- `GET /project/:projectId`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`

ITR (`server/src/routes/itrRoutes.js`, mounted at `/api/itr`)
- `POST /upload` (multipart: `file`)
- `POST /`
- `GET /`
- `GET /project/:projectId`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`

Samples (`server/src/routes/sampleRoutes.js`, mounted at `/api/sample`)
- `POST /upload` (multipart array field: `file`)
- `POST /` (also `POST /create-sample` exists; both call create)
- `GET /`
- `GET /project/:projectId`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`

Inventory (`server/src/routes/inventoryRoutes.js`, mounted at `/api/inventory`)
- `POST /`
- `GET /`
- `GET /project/:projectId`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`

Vendors (`server/src/routes/vendorRoutes.js`, mounted at `/api/vendors`)
- `POST /`
- `GET /`
- `GET /project/:projectId`
- `GET /:id`
- `PUT /:id`
- `PATCH /:id/status`
- `DELETE /:id`

Vendor Price List (`server/src/routes/vendorPriceListRoutes.js`, mounted at `/api/vendor-price-list`)
- `POST /upload` (multipart: `file`)
- `GET /vendor/:vendorId`
- `GET /:id`
- `POST /`
- `PUT /:id`
- `DELETE /:id`
- `PATCH /:id/status`

PR email (`server/src/routes/prRoutes.js`, mounted at `/api/pr`)
- `POST /email` (multipart: `attachment`)

## React vs Flutter Differences (Verified)

See `REACT_FLUTTER_APP_DIFFERENCES.md` for routing + architecture differences, including:
- React uses `/:projectId/...` route prefix; Flutter stores selected project in app state.
- Some pages/routes exist in one client but are not wired in the other.

## Known Gaps / Mismatches (Backend vs Client Expectations)

Both clients (especially `client/src/lib/api.js` and `madhuram_app/lib/services/api_client.dart`) reference endpoints that are **not implemented** in `server/src/server.js` in this workspace, including (non-exhaustive):
- Access catalog and per-user access checks: `/api/access/*`
- Dashboard stats/activity/notifications: `/api/dashboard/*` and websocket `/ws/activity`
- Attendance: `/api/attendance/*`
- Notifications v1: `/api/v1/notifications/*`
- PR lifecycle endpoints: `/api/pr/*` beyond `/api/pr/email`
- PO/PR email attachment + logs endpoints: `/api/po/:id/send-email`, `/api/pr/:id/send-email`, etc.
- “Quotations” + parsing helpers: `/api/quotations/*`, `/api/po-parser/parse`, `/api/boq/parse-pdf`
- Inventory extensions beyond CRUD: `/api/inventory/search`, `/api/inventory/:id/history`, `/api/inventory/:id/movement`, etc.
- Inventory trace/history services: `/api/inventory-trace/*`, `/api/inventory-history/*`
- Vendor price list utilities: `/api/vendor-price-list/compare`, `/api/vendor-price-list/bulk-upload-inventory/*`

If you intend to run everything against the backend in this repo, either:
- Implement the missing routes/controllers (see API specs in `Ethernet-CRM-pr-executive-management/apis/`), or
- Remove/feature-flag the client calls that target non-existent endpoints.

## Frontend Notes / Issues Observed

- `Ethernet-CRM-pr-executive-management/client/src/pages/StockAreas.jsx` uses **hardcoded demo data** (not wired to backend), so it won’t reflect real inventory/warehouse state.
- Backend auth enforcement is inconsistent: `projectRoutes.js` protects all routes via `router.use(authenticate)`, while many other routers currently do not. If the UI assumes auth for these modules, add middleware on the backend.
- `Ethernet-CRM-pr-executive-management/server/ENV_EXAMPLE.md` mentions `API_BASE_URL=http://localhost:3000/api/v1`, but the backend routes in `server/src/server.js` are mounted under `/api/*` (no `/api/v1` prefix).

## Supporting Docs
- React↔Flutter parity mapping: `madhuram_app/API_MAPPING.md`
- API specs by module: `Ethernet-CRM-pr-executive-management/apis/`
- Parity tracker: `PARITY_IMPLEMENTATION_TRACKER.md`
