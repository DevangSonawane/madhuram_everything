# React Web App vs Flutter App - Verified Differences

Compared projects:
- React web app: `Ethernet-CRM-pr-executive-management/client`
- Flutter app: `madhuram_app`

## 1) Core tech stack

- React app uses `React 19 + Vite + Tailwind + Radix UI + React Router + Redux Toolkit`.
- Flutter app uses `Flutter (Dart SDK ^3.10.0) + Material + flutter_redux + custom theme/store`.

## 2) State management architecture

- React mixes **Redux Toolkit** (auth slice) with multiple **Contexts** (`AuthContext`, `ProjectContext`, `NotificationContext`, `ThemeContext`).
- Flutter uses a **single Redux-style global AppState** with reducers for auth, project, theme, notification.

## 3) Authentication/session persistence

- React persists user in `localStorage` key `inventory_user` (via `authSlice`) and selected project in `selected_project_id` (via `ProjectContext`).
- Flutter persists the same keys in `SharedPreferences` via `AuthStorage`, then restores them on app startup before rendering.

## 4) Routing model differences

### React routing

- Uses nested routes with project-scoped URLs: `/:projectId/...`
- Login entry at `/` (and `/login` redirects to `/`).
- Most business pages are children of `/:projectId`.

### Flutter routing

- Uses `MaterialApp` routes + `onGenerateRoute`.
- No `/:projectId` path prefix; selected project comes from app state.
- Initial screen decision is state-driven (`AppRouter`): login -> project selection -> dashboard.

## 5) Route/feature parity gaps

### Present in React routes but not exposed as Flutter named routes

- `/users`
- `/settings` (mapped to Profile in React)
- `/inventory` (Flutter has `/inventory/add`, but no dedicated `/inventory` route in `main.dart`)
- `/purchase-orders/preview`
- `/mir/preview`
- `/itr/preview`

### Present in Flutter routes but not in React `App.jsx`

- `/vendors/new`
- `/challans/detail` (argument-driven)
- `/samples/create` (argument-driven)

## 6) Dynamic route param style

- React uses URL params directly in route path (e.g. `samples/preview/:id`, `samples/edit/:id`).
- Flutter passes IDs as route arguments in `onGenerateRoute` for `'/samples/preview'`, `'/samples/edit'`, `'/challans/detail'`.

## 7) API client implementation

- React central API is `client/src/lib/api.js` (fetch-based; includes websocket URL helper).
- Flutter central API is `lib/services/api_client.dart` (http package, retry/error wrappers, multipart support).

## 8) Platform scope

- React target is web browser.
- Flutter project is multi-platform (`android`, `ios`, `web`, `macos`, `windows`, `linux`).

## 9) Testing status (current repository state)

- React client: no app-level tests found under `client/src`.
- Flutter: only default `test/widget_test.dart` present.

## 10) Quick conclusion

Both apps implement largely the same domain modules (projects, BOQ, procurement, challans, MIR/ITR, reports, audit, profile), but they diverge in:
- URL/routing strategy (project path param vs state-selected project)
- Some route exposure (users/settings/inventory/preview pages)
- A few creation/detail flows present in Flutter routes but not wired in React routes.
