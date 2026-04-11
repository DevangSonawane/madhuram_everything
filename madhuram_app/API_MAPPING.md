# API Mapping: React to Flutter

## Base URL
`https://api.madhuram.enterprises`

## Authentication
All authenticated endpoints use: `Authorization: Bearer <token>`

## Server Reality
- Only `/api/auth/*` and `/api/po/*` have real server controllers
- Other endpoints may return 404 unless server has been extended
- Both apps handle demo-token with mock data

## Endpoints

### Authentication
| Method | Endpoint | React | Flutter | Notes |
|--------|----------|-------|---------|-------|
| POST | /api/auth/login | api.login() | ApiClient.login() | Both implemented |
| POST | /api/auth/signup | api.signup() | ApiClient.signup() | Both implemented |
| POST | /api/auth/logout | api.logout() | ApiClient.logout() | Both implemented |
| POST | /api/auth/forgot-password | api.forgotPassword() | ApiClient.forgotPassword() | Both implemented |
| GET | /api/auth/users | api.getUsers() | ApiClient.getUsers() | Both implemented |
| PUT | /api/auth/users/:id | api.updateUser() | ApiClient.updateUser() | Both implemented |
| DELETE | /api/auth/users/:id | api.deleteUser() | ApiClient.deleteUser() | Both implemented |

### Projects
| Method | Endpoint | React | Flutter | Notes |
|--------|----------|-------|---------|-------|
| POST | /api/projects | api.createProject() | ApiClient.createProjectWithFiles() | multipart/form-data |
| GET | /api/projects | api.getProjects() | ApiClient.getProjects() | Both implemented |
| GET | /api/projects/:id | api.getProjectById() | ApiClient.getProject() | Both implemented |
| PUT | /api/projects/:id | api.updateProject() | ApiClient.updateProjectWithFiles() | multipart/form-data |
| DELETE | /api/projects/:id | api.deleteProject() | ApiClient.deleteProject() | Both implemented |

### BOQ
| Method | Endpoint | React | Flutter | Notes |
|--------|----------|-------|---------|-------|
| POST | /api/boq | api.createBOQ() | ApiClient.createBOQ() / createBOQWithFile() | Both implemented |
| GET | /api/boq | api.getBOQs() | ApiClient.getAllBOQs() | Both implemented |
| GET | /api/boq/:id | api.getBOQById() | ApiClient.getBOQ() | Both implemented |
| GET | /api/boq/project/:id | api.getBOQsByProject() | ApiClient.getBOQsByProject() | Both implemented |
| PUT | /api/boq/:id | api.updateBOQ() | ApiClient.updateBOQ() / updateBOQWithFile() | Both implemented |
| DELETE | /api/boq/:id | api.deleteBOQ() | ApiClient.deleteBOQ() | Both implemented |

### Purchase Orders
| Method | Endpoint | React | Flutter | Notes |
|--------|----------|-------|---------|-------|
| POST | /api/po/upload | api.uploadPoFile() | ApiClient.uploadPOFile() | Both implemented |
| POST | /api/po | api.createPo() | ApiClient.createPO() | Both implemented |
| GET | /api/po/project/:id | api.getPosByProject() | ApiClient.getPOsByProject() | Both implemented |
| GET | /api/po/:id | api.getPoById() | ApiClient.getPO() | Both implemented |
| PUT | /api/po/:id | api.updatePo() | ApiClient.updatePO() | Both implemented |
| DELETE | /api/po/:id | api.deletePo() | ApiClient.deletePO() | Both implemented |

### MIR
| Method | Endpoint | React | Flutter | Notes |
|--------|----------|-------|---------|-------|
| POST | /api/mir/upload | api.uploadMirReference() | ApiClient.uploadMIRFile() | Both implemented |
| POST | /api/mir | api.createMir() | ApiClient.createMIR() | Both implemented |
| GET | /api/mir | api.getMirs() | ApiClient.getAllMIRs() | Both implemented |
| GET | /api/mir/:id | api.getMirById() | ApiClient.getMIR() | Both implemented |
| GET | /api/mir/project/:id | api.getMirsByProject() | ApiClient.getMIRsByProject() | Both implemented |
| PUT | /api/mir/:id | api.updateMir() | ApiClient.updateMIR() | Both implemented |
| DELETE | /api/mir/:id | api.deleteMir() | ApiClient.deleteMIR() | Both implemented |

### ITR
| Method | Endpoint | React | Flutter | Notes |
|--------|----------|-------|---------|-------|
| POST | /api/itr | api.createItr() | ApiClient.createITR() | Both implemented |
| GET | /api/itr | api.getItrs() | ApiClient.getAllITRs() | Both implemented |
| GET | /api/itr/:id | api.getItrById() | ApiClient.getITR() | Both implemented |
| GET | /api/itr/project/:id | api.getItrsByProject() | ApiClient.getITRsByProject() | Both implemented |
| PUT | /api/itr/:id | api.updateItr() | ApiClient.updateITR() | Both implemented |
| DELETE | /api/itr/:id | api.deleteItr() | ApiClient.deleteITR() | Both implemented |

### Other Endpoints (Server may not have controllers)
| Method | Endpoint | React | Flutter | Notes |
|--------|----------|-------|---------|-------|
| GET | /api/vendors | Mock data | ApiClient.getVendors() | Flutter has demo fallback |
| POST | /api/vendors | Mock data | ApiClient.createVendor() | Flutter implemented |
| PUT | /api/vendors/:id | Mock data | ApiClient.updateVendor() | Flutter implemented |
| DELETE | /api/vendors/:id | Mock data | ApiClient.deleteVendor() | Flutter implemented |
| GET | /api/materials | Mock data | ApiClient.getMaterials() | Flutter has demo fallback |
| GET | /api/stock-areas | Mock data | ApiClient.getStockAreas() | Flutter has demo fallback |
| GET | /api/stock-transfers/project/:id | Mock data | ApiClient.getStockTransfers() | Flutter has demo fallback |
| GET | /api/consumption/project/:id | Mock data | ApiClient.getConsumption() | Flutter has demo fallback |
| GET | /api/returns/project/:id | Mock data | ApiClient.getReturns() | Flutter has demo fallback |
| GET | /api/challans/project/:id | Mock data | ApiClient.getChallansByProject() | Flutter has demo fallback |
| GET | /api/billing/project/:id | Mock data | ApiClient.getBillingByProject() | Flutter has demo fallback |
| GET | /api/reports/project/:id | Mock data | ApiClient.getReports() | Flutter has demo fallback |
| GET | /api/audit-logs/project/:id | Mock data | ApiClient.getAuditLogs() | Flutter has demo fallback |
| GET | /api/dashboard/:id | Mock data | ApiClient.getDashboardStats() | Flutter has demo fallback |
| POST | /api/compress | api.compressFile() | ApiClient.compressFile() | Both implemented |

### Notifications
| Method | Endpoint | React | Flutter | Notes |
|--------|----------|-------|---------|-------|
| GET | /api/v1/notifications | NotificationContext | ApiClient.getNotifications() | Both implemented |
| PATCH | /api/v1/notifications/:id/read | NotificationContext | ApiClient.markNotificationRead() | Both implemented |
| PATCH | /api/v1/notifications/read-all | NotificationContext | ApiClient.markAllNotificationsRead() | Both implemented |
| DELETE | /api/v1/notifications/:id | NotificationContext | ApiClient.deleteNotification() | Both implemented |

## Conclusion
All React API endpoints have corresponding Flutter implementations. The API client layer is at full parity.
