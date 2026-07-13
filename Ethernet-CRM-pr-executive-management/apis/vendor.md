
# Madhuram Vendor API Documentation

**Base URL:** `https://api.madhuram.enterprises`

---

## 1. Create a Vendor

**POST** `/api/vendors`

Creates a new vendor record.

**Request Body (JSON):**

| Field | Type | Required | Description |
|---|---|---|---|
| vendor_name | string | ✅ Yes | Name of the vendor |
| project_id | integer | No | Associated project ID |
| vendor_company_name | string | No | Company name |
| vendor_email | string | No | Email address |
| mobile_number | string | No | Mobile number |
| location | string | No | Location |
| status | string | No | `active` / `inactive` / `blocked` (default: `active`) |

**Example Request:**
```json
{
  "project_id": 1,
  "vendor_name": "John Doe",
  "vendor_company_name": "Doe Supplies",
  "vendor_email": "john@example.com",
  "mobile_number": "9876543210",
  "location": "Chennai",
  "status": "active"
}
```

**Responses:**
- `201 Created` – Vendor created successfully, returns vendor object
- `500 Internal Server Error` – Server error

---

## 2. Get All Vendors

**GET** `/api/vendors`

Returns a list of all vendors, ordered by newest first.

**No request body or parameters required.**

**Responses:**
- `200 OK` – Returns array of vendor objects
- `500 Internal Server Error` – Server error

---

## 3. Get Vendors by Project

**GET** `/api/vendors/project/:projectId`

Returns all vendors belonging to a specific project.

**Path Parameter:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| projectId | integer | ✅ Yes | The project ID to filter vendors |

**Example:** `GET /api/vendors/project/1`

**Responses:**
- `200 OK` – Returns array of vendor objects for that project
- `500 Internal Server Error` – Server error

---

## 4. Get Single Vendor

**GET** `/api/vendors/:id`

Returns a single vendor by their ID.

**Path Parameter:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| id | integer | ✅ Yes | The vendor ID |

**Example:** `GET /api/vendors/5`

**Responses:**
- `200 OK` – Returns vendor object
- `404 Not Found` – Vendor not found
- `500 Internal Server Error` – Server error

---

## 5. Update a Vendor

**PUT** `/api/vendors/:id`

Updates an existing vendor. All fields are optional — only the fields you send will be updated.

**Path Parameter:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| id | integer | ✅ Yes | The vendor ID to update |

**Request Body (JSON):**

| Field | Type | Required | Description |
|---|---|---|---|
| vendor_name | string | No | Name of the vendor |
| project_id | integer | No | Associated project ID |
| vendor_company_name | string | No | Company name |
| vendor_email | string | No | Email address |
| mobile_number | string | No | Mobile number |
| location | string | No | Location |
| status | string | No | `active` / `inactive` / `blocked` |

**Example Request:**
```json
{
  "vendor_name": "Jane Doe",
  "location": "Mumbai"
}
```

**Responses:**
- `200 OK` – Returns updated vendor object
- `404 Not Found` – Vendor not found
- `500 Internal Server Error` – Server error

---

## 6. Update Vendor Status

**PATCH** `/api/vendors/:id/status`

Updates only the status of a vendor.

**Path Parameter:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| id | integer | ✅ Yes | The vendor ID |

**Request Body (JSON):**

| Field | Type | Required | Description |
|---|---|---|---|
| status | string | ✅ Yes | Must be `active`, `inactive`, or `blocked` |

**Example Request:**
```json
{
  "status": "blocked"
}
```

**Responses:**
- `200 OK` – Returns updated vendor object
- `400 Bad Request` – Invalid status value
- `404 Not Found` – Vendor not found
- `500 Internal Server Error` – Server error

---

## 7. Delete a Vendor

**DELETE** `/api/vendors/:id`

Permanently deletes a vendor by ID.

**Path Parameter:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| id | integer | ✅ Yes | The vendor ID to delete |

**Example:** `DELETE /api/vendors/5`

**Responses:**
- `200 OK` – `{ "message": "Vendor deleted successfully" }`
- `404 Not Found` – Vendor not found
- `500 Internal Server Error` – Server error

---

## Vendor Object Schema

```json
{
  "vendor_id": 1,
  "project_id": 1,
  "vendor_name": "John Doe",
  "vendor_company_name": "Doe Supplies",
  "vendor_email": "john@example.com",
  "mobile_number": "9876543210",
  "location": "Chennai",
  "status": "active",
  "created_at": "2025-01-01T10:00:00.000Z",
  "updated_at": "2025-01-01T10:00:00.000Z"
}
```

---

## Status Enum Values

| Value | Meaning |
|---|---|
| `active` | Vendor is active (default) |
| `inactive` | Vendor is inactive |
| `blocked` | Vendor is blocked |

---

> **Note for frontend:** When creating a vendor, make sure the `project_id` you pass already exists in the system. Passing a non-existent `project_id` will result in a `500` error due to a foreign key constraint.
