# 📘 AgencyOS CRM — Backend API Documentation

> **Base URL:** `http://localhost:5000/api`
>
> **Authentication:** JWT Bearer token in `Authorization` header.
> Refresh token stored in `httpOnly` cookie.
>
> **Content-Type:** `application/json` (unless noted otherwise)

---

## Table of Contents

| # | Section | Endpoints |
|---|---------|-----------|
| 1 | [Health Check](#1-health-check) | 1 |
| 2 | [Authentication](#2-authentication) | 6 |
| 3 | [Users](#3-users) | 4 |
| 4 | [Clients](#4-clients) | 6 |
| 5 | [Tasks](#5-tasks) | 4 |
| 6 | [Todos](#6-todos) | 4 |
| 7 | [Meetings](#7-meetings) | 4 |
| 8 | [Messages](#8-messages) | 3 |
| 9 | [Reports](#9-reports) | 1 |
| 10 | [Work Log](#10-work-log) | 3 |
| 11 | [WebSocket Events](#11-websocket-events) | — |
| 12 | [Error Handling](#12-global-error-handling) | — |

---

## Authentication Info

All protected routes require the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

**Roles:** `admin`, `manager`, `member`

| Middleware | Description |
|-----------|-------------|
| `protect` | Verifies access token. Attaches `req.user`. Required for all routes except login & refresh. |
| `authorize(...roles)` | Checks if `req.user.role` is in the allowed roles list. Returns `403` if not. |

---

## 1. Health Check

### 1.1 Server Health

> Returns server status and current timestamp.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/health` |
| **Method** | `GET` |
| **Auth** | ❌ None |
| **Body** | None |

**✅ Success Response** `200 OK`

```json
{
  "status": "OK",
  "timestamp": "2026-05-23T11:00:00.000Z"
}
```

---

## 2. Authentication

### 2.1 Login

> Authenticates a user with email and password. Returns access token and user object. Sets refresh token as `httpOnly` cookie.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/auth/login` |
| **Method** | `POST` |
| **Auth** | ❌ None |

**📦 Request Body**

```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | `string` | ✅ | User's email address |
| `password` | `string` | ✅ | User's password |

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "664f...",
    "id": "664f...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "position": "CEO",
    "department": "Management",
    "phone": "+91-9876543210",
    "color": "#6366f1",
    "initials": "JD",
    "status": "online",
    "joinDate": "2024-01-15",
    "bio": "Founder of the agency",
    "avatar": null
  }
}
```

> **Note:** A `refreshToken` cookie is also set with `httpOnly`, `maxAge: 7 days`.

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `400` | Missing email or password | `{ "success": false, "message": "Email and password required" }` |
| `401` | Invalid email | `{ "success": false, "message": "Invalid email or password" }` |
| `401` | Wrong password | `{ "success": false, "message": "Invalid email or password" }` |

---

### 2.2 Logout

> Logs out the current user. Sets user status to `offline` and clears refresh token cookie.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/auth/logout` |
| **Method** | `POST` |
| **Auth** | 🔒 Bearer Token |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "message": "Logged out"
}
```

---

### 2.3 Refresh Token

> Issues a new access token and refresh token using the `refreshToken` cookie. No Authorization header required.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/auth/refresh` |
| **Method** | `POST` |
| **Auth** | 🍪 Refresh Token Cookie |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { /* same as login response */ }
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `401` | No refresh token cookie | `{ "success": false, "message": "No refresh token" }` |
| `401` | User not found | `{ "success": false, "message": "User not found" }` |
| `401` | Token expired / invalid | `{ "success": false, "message": "Refresh token expired, please login again" }` |

---

### 2.4 Get Current User

> Returns the currently authenticated user's profile.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/auth/me` |
| **Method** | `GET` |
| **Auth** | 🔒 Bearer Token |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "user": {
    "_id": "664f...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "position": "CEO",
    "department": "Management",
    "phone": "+91-9876543210",
    "color": "#6366f1",
    "initials": "JD",
    "status": "online",
    "joinDate": "2024-01-15",
    "bio": "Founder of the agency",
    "avatar": null,
    "createdAt": "2024-01-15T00:00:00.000Z",
    "updatedAt": "2026-05-23T11:00:00.000Z"
  }
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `401` | Missing / invalid token | `{ "success": false, "message": "Not authenticated" }` |

---

### 2.5 Update Profile

> Updates the current user's profile fields (name, email, position, phone, bio).

| Field | Value |
|-------|-------|
| **Endpoint** | `PUT /api/auth/profile` |
| **Method** | `PUT` |
| **Auth** | 🔒 Bearer Token |

**📦 Request Body**

```json
{
  "name": "John D.",
  "email": "john.d@example.com",
  "position": "CTO",
  "phone": "+91-1234567890",
  "bio": "Updated bio"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ❌ | Display name |
| `email` | `string` | ❌ | Email address |
| `position` | `string` | ❌ | Job position / title |
| `phone` | `string` | ❌ | Phone number |
| `bio` | `string` | ❌ | Short bio |

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "user": { /* updated user object */ }
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `400` | Validation error (e.g. duplicate email) | `{ "success": false, "message": "email already exists" }` |
| `401` | Not authenticated | `{ "success": false, "message": "Not authenticated" }` |

---

### 2.6 Change Password

> Changes the current user's password. Requires the current password for verification.

| Field | Value |
|-------|-------|
| **Endpoint** | `PUT /api/auth/password` |
| **Method** | `PUT` |
| **Auth** | 🔒 Bearer Token |

**📦 Request Body**

```json
{
  "currentPassword": "oldSecret123",
  "newPassword": "newSecret456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currentPassword` | `string` | ✅ | Current password for verification |
| `newPassword` | `string` | ✅ | New password (min 6 characters) |

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `400` | Wrong current password | `{ "success": false, "message": "Current password is incorrect" }` |
| `401` | Not authenticated | `{ "success": false, "message": "Not authenticated" }` |

---

## 3. Users

> All user routes require authentication (`protect` middleware).
> Create, update, and delete require `admin` or `manager` role.

### 3.1 Get All Users

> Returns a list of all users, sorted by creation date (ascending).

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/users` |
| **Method** | `GET` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "664f...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "admin",
      "position": "CEO",
      "department": "Management",
      "phone": "+91-9876543210",
      "color": "#6366f1",
      "initials": "JD",
      "status": "online",
      "joinDate": "2024-01-15",
      "bio": "Founder",
      "avatar": null,
      "createdAt": "2024-01-15T00:00:00.000Z",
      "updatedAt": "2026-05-23T11:00:00.000Z"
    }
  ]
}
```

---

### 3.2 Create User

> Creates a new user account. Password is automatically hashed. Initials are auto-generated from name.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/users` |
| **Method** | `POST` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | `admin`, `manager` |

**📦 Request Body**

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "secret123",
  "role": "member",
  "position": "Designer",
  "department": "Creative",
  "phone": "+91-9876543210",
  "color": "#ec4899",
  "joinDate": "2024-06-01",
  "bio": "Senior designer"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | ✅ | — | Full name |
| `email` | `string` | ✅ | — | Unique email (auto lowercased) |
| `password` | `string` | ✅ | — | Min 6 characters |
| `role` | `string` | ❌ | `"member"` | One of: `admin`, `manager`, `member` |
| `position` | `string` | ❌ | `"Team Member"` | Job title |
| `department` | `string` | ❌ | `"General"` | Department name |
| `phone` | `string` | ❌ | `""` | Phone number |
| `color` | `string` | ❌ | `"#6366f1"` | Profile color (hex) |
| `joinDate` | `string` | ❌ | `""` | Date joined |
| `bio` | `string` | ❌ | `""` | Short bio |

**✅ Success Response** `201 Created`

```json
{
  "success": true,
  "data": { /* created user object */ }
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `400` | Missing required fields | `{ "success": false, "message": "Name is required" }` |
| `400` | Duplicate email | `{ "success": false, "message": "email already exists" }` |
| `403` | Insufficient role | `{ "success": false, "message": "Role 'member' is not authorized for this action" }` |

---

### 3.3 Update User

> Updates an existing user by ID. Password field is explicitly excluded from updates.

| Field | Value |
|-------|-------|
| **Endpoint** | `PUT /api/users/:id` |
| **Method** | `PUT` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | `admin`, `manager` |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the user |

**📦 Request Body**

```json
{
  "name": "Jane Smith-Updated",
  "role": "manager",
  "position": "Lead Designer"
}
```

> Any user fields except `password` can be provided. Only provided fields are updated.

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": { /* updated user object */ }
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `404` | User not found | `{ "success": false, "message": "User not found" }` |
| `403` | Insufficient role | `{ "success": false, "message": "Role 'member' is not authorized for this action" }` |

---

### 3.4 Delete User

> Deletes a user by ID. Users cannot delete their own account.

| Field | Value |
|-------|-------|
| **Endpoint** | `DELETE /api/users/:id` |
| **Method** | `DELETE` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | `admin`, `manager` |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the user |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "message": "User removed"
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `400` | Deleting own account | `{ "success": false, "message": "Cannot delete your own account" }` |
| `403` | Insufficient role | `{ "success": false, "message": "Role 'member' is not authorized for this action" }` |

---

## 4. Clients

> All client routes require authentication.
> Create, update, and delete require `admin` or `manager` role.
> `assignedTeam` is populated with user details in all responses.

### 4.1 Get All Clients

> Returns all clients sorted by creation date (newest first), with assigned team members populated.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/clients` |
| **Method** | `GET` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "665a...",
      "name": "Acme Corp",
      "contact": "Bob Smith",
      "email": "bob@acme.com",
      "phone": "+1-555-1234",
      "website": "https://acme.com",
      "industry": "Technology",
      "address": "123 Main St, NYC",
      "services": ["SEO", "Web Design"],
      "budget": "₹5,00,000",
      "contractDuration": "12 months",
      "status": "active",
      "paymentStatus": "paid",
      "projectCount": 3,
      "onboardingDate": "2024-03-15",
      "assignedTeam": [
        {
          "_id": "664f...",
          "name": "John Doe",
          "email": "john@example.com",
          "color": "#6366f1",
          "initials": "JD",
          "status": "online",
          "position": "CEO"
        }
      ],
      "notes": [
        {
          "_id": "665b...",
          "text": "Initial call went well",
          "author": "John Doe",
          "date": "May 23, 2026",
          "createdAt": "2026-05-23T...",
          "updatedAt": "2026-05-23T..."
        }
      ],
      "createdBy": "664f...",
      "createdAt": "2024-03-15T00:00:00.000Z",
      "updatedAt": "2026-05-23T11:00:00.000Z"
    }
  ]
}
```

---

### 4.2 Get Client by ID

> Returns a single client by its MongoDB ObjectId.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/clients/:id` |
| **Method** | `GET` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the client |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": { /* client object with populated assignedTeam */ }
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `404` | Client not found | `{ "success": false, "message": "Client not found" }` |
| `404` | Invalid ObjectId format | `{ "success": false, "message": "Resource not found" }` |

---

### 4.3 Create Client

> Creates a new client. The `createdBy` field is automatically set to the authenticated user.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/clients` |
| **Method** | `POST` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | `admin`, `manager` |

**📦 Request Body**

```json
{
  "name": "Acme Corp",
  "contact": "Bob Smith",
  "email": "bob@acme.com",
  "phone": "+1-555-1234",
  "website": "https://acme.com",
  "industry": "Technology",
  "address": "123 Main St, NYC",
  "services": ["SEO", "Web Design"],
  "budget": "₹5,00,000",
  "contractDuration": "12 months",
  "status": "active",
  "paymentStatus": "paid",
  "projectCount": 3,
  "onboardingDate": "2024-03-15",
  "assignedTeam": ["664f...", "664g..."]
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | ✅ | — | Company name |
| `contact` | `string` | ✅ | — | Contact person name |
| `email` | `string` | ❌ | `""` | Company email |
| `phone` | `string` | ❌ | `""` | Phone number |
| `website` | `string` | ❌ | `""` | Website URL |
| `industry` | `string` | ❌ | `""` | Industry sector |
| `address` | `string` | ❌ | `""` | Physical address |
| `services` | `string[]` | ❌ | `[]` | List of services |
| `budget` | `string` | ❌ | `""` | Budget amount |
| `contractDuration` | `string` | ❌ | `"12 months"` | Contract duration |
| `status` | `string` | ❌ | `"active"` | One of: `active`, `on-hold`, `inactive` |
| `paymentStatus` | `string` | ❌ | `"pending"` | One of: `paid`, `pending`, `overdue` |
| `projectCount` | `number` | ❌ | `0` | Number of projects |
| `onboardingDate` | `string` | ❌ | `""` | Date onboarded |
| `assignedTeam` | `ObjectId[]` | ❌ | `[]` | Array of User ObjectIds |

**✅ Success Response** `201 Created`

```json
{
  "success": true,
  "data": { /* created client with populated assignedTeam */ }
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `400` | Missing company name | `{ "success": false, "message": "Company name is required" }` |
| `400` | Missing contact | `{ "success": false, "message": "Contact person is required" }` |
| `403` | Insufficient role | `{ "success": false, "message": "Role 'member' is not authorized for this action" }` |

---

### 4.4 Update Client

> Updates an existing client by ID.

| Field | Value |
|-------|-------|
| **Endpoint** | `PUT /api/clients/:id` |
| **Method** | `PUT` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | `admin`, `manager` |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the client |

**📦 Request Body:** Any client fields to update (see Create Client).

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": { /* updated client object */ }
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `404` | Client not found | `{ "success": false, "message": "Client not found" }` |
| `403` | Insufficient role | `{ "success": false, "message": "Role 'member' is not authorized for this action" }` |

---

### 4.5 Delete Client

> Deletes a client by ID.

| Field | Value |
|-------|-------|
| **Endpoint** | `DELETE /api/clients/:id` |
| **Method** | `DELETE` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | `admin`, `manager` |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the client |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "message": "Client deleted"
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `403` | Insufficient role | `{ "success": false, "message": "Role 'member' is not authorized for this action" }` |

---

### 4.6 Add Client Note

> Appends a note to a client's notes array. Author name and formatted date are auto-generated.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/clients/:id/notes` |
| **Method** | `POST` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the client |

**📦 Request Body**

```json
{
  "text": "Client approved the new design mockups"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | ✅ | Note content |

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": { /* updated client object with new note appended */ }
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `404` | Client not found | `{ "success": false, "message": "Client not found" }` |

---

## 5. Tasks

> All task routes require authentication.
> Delete requires `admin` or `manager` role.
> Members can only see tasks assigned to them.
> Socket events are emitted on create, update, and delete.

### 5.1 Get All Tasks

> Returns tasks sorted by creation date (newest first). Members only see their own assigned tasks.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/tasks` |
| **Method** | `GET` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "665c...",
      "title": "Design homepage",
      "description": "Create new homepage design for Acme Corp",
      "assignedTo": {
        "_id": "664f...",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "color": "#ec4899",
        "initials": "JS",
        "status": "online"
      },
      "assignedBy": {
        "_id": "664e...",
        "name": "John Doe"
      },
      "clientId": {
        "_id": "665a...",
        "name": "Acme Corp"
      },
      "type": "client",
      "dueDate": "2026-06-01",
      "eta": "3 days",
      "priority": "high",
      "status": "in-progress",
      "progress": 40,
      "tags": ["design", "homepage"],
      "createdAt": "2026-05-20T00:00:00.000Z",
      "updatedAt": "2026-05-23T11:00:00.000Z"
    }
  ]
}
```

---

### 5.2 Create Task

> Creates a new task. The `assignedBy` field is automatically set to the authenticated user.
> Emits `task:created` socket event.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/tasks` |
| **Method** | `POST` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**📦 Request Body**

```json
{
  "title": "Design homepage",
  "description": "Create new homepage design",
  "assignedTo": "664f...",
  "clientId": "665a...",
  "type": "client",
  "dueDate": "2026-06-01",
  "eta": "3 days",
  "priority": "high",
  "status": "pending",
  "progress": 0,
  "tags": ["design", "homepage"]
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | `string` | ✅ | — | Task title |
| `description` | `string` | ❌ | `""` | Task description |
| `assignedTo` | `ObjectId` | ✅ | — | User ObjectId to assign |
| `clientId` | `ObjectId` | ❌ | `null` | Associated client |
| `type` | `string` | ❌ | `"inhouse"` | One of: `inhouse`, `client` |
| `dueDate` | `string` | ❌ | `""` | Due date |
| `eta` | `string` | ❌ | `""` | Estimated time of completion |
| `priority` | `string` | ❌ | `"medium"` | One of: `urgent`, `high`, `medium`, `low` |
| `status` | `string` | ❌ | `"pending"` | One of: `pending`, `in-progress`, `sent-for-approval`, `completed` |
| `progress` | `number` | ❌ | `0` | Progress percentage (0–100) |
| `tags` | `string[]` | ❌ | `[]` | Tags / labels |

**✅ Success Response** `201 Created`

```json
{
  "success": true,
  "data": { /* created task with populated assignedTo, assignedBy, clientId */ }
}
```

**🔌 Socket Event:** `task:created` — broadcasts the populated task object.

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `400` | Missing title | `{ "success": false, "message": "Title is required" }` |
| `400` | Missing assignedTo | `{ "success": false, "message": "Path 'assignedTo' is required." }` |

---

### 5.3 Update Task

> Updates an existing task by ID.
> Emits `task:updated` socket event.

| Field | Value |
|-------|-------|
| **Endpoint** | `PUT /api/tasks/:id` |
| **Method** | `PUT` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the task |

**📦 Request Body:** Any task fields to update (see Create Task).

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": { /* updated task object */ }
}
```

**🔌 Socket Event:** `task:updated` — broadcasts the updated task object.

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `404` | Task not found | `{ "success": false, "message": "Task not found" }` |

---

### 5.4 Delete Task

> Deletes a task by ID. Emits `task:deleted` socket event with the task ID.

| Field | Value |
|-------|-------|
| **Endpoint** | `DELETE /api/tasks/:id` |
| **Method** | `DELETE` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | `admin`, `manager` |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the task |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "message": "Task deleted"
}
```

**🔌 Socket Event:** `task:deleted` — broadcasts the deleted task's `id` string.

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `403` | Insufficient role | `{ "success": false, "message": "Role 'member' is not authorized for this action" }` |

---

## 6. Todos

> All todo routes require authentication.
> Members only see their own todos.
> The `userId` is automatically set to the authenticated user on creation.

### 6.1 Get All Todos

> Returns todos sorted by creation date (newest first). Members only see their own.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/todos` |
| **Method** | `GET` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "665d...",
      "title": "Review PR #42",
      "description": "Check the API changes",
      "userId": {
        "_id": "664f...",
        "name": "John Doe",
        "color": "#6366f1",
        "initials": "JD",
        "status": "online"
      },
      "eta": "1 hour",
      "priority": "high",
      "status": "pending",
      "createdAt": "2026-05-23T...",
      "updatedAt": "2026-05-23T..."
    }
  ]
}
```

---

### 6.2 Create Todo

> Creates a new todo. The `userId` is automatically set to the authenticated user.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/todos` |
| **Method** | `POST` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**📦 Request Body**

```json
{
  "title": "Review PR #42",
  "description": "Check the API changes",
  "eta": "1 hour",
  "priority": "high",
  "status": "pending"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | `string` | ✅ | — | Todo title |
| `description` | `string` | ❌ | `""` | Description |
| `eta` | `string` | ❌ | `""` | Estimated time |
| `priority` | `string` | ❌ | `"medium"` | One of: `urgent`, `high`, `medium`, `low` |
| `status` | `string` | ❌ | `"pending"` | One of: `pending`, `in-progress`, `sent-for-approval`, `completed` |

**✅ Success Response** `201 Created`

```json
{
  "success": true,
  "data": { /* created todo with populated userId */ }
}
```

---

### 6.3 Update Todo

> Updates an existing todo by ID.

| Field | Value |
|-------|-------|
| **Endpoint** | `PUT /api/todos/:id` |
| **Method** | `PUT` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the todo |

**📦 Request Body:** Any todo fields to update (see Create Todo).

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": { /* updated todo object */ }
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `404` | Todo not found | `{ "success": false, "message": "Todo not found" }` |

---

### 6.4 Delete Todo

> Deletes a todo by ID.

| Field | Value |
|-------|-------|
| **Endpoint** | `DELETE /api/todos/:id` |
| **Method** | `DELETE` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the todo |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "message": "Todo deleted"
}
```

---

## 7. Meetings

> All meeting routes require authentication.
> Create, update, and delete require `admin` or `manager` role.
> Socket events are emitted on creation.

### 7.1 Get All Meetings

> Returns all meetings sorted by date and time (ascending). Participants and client are populated.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/meetings` |
| **Method** | `GET` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "665e...",
      "title": "Sprint Planning",
      "type": "internal",
      "date": "2026-05-25",
      "time": "10:00",
      "duration": "60 min",
      "status": "upcoming",
      "participants": [
        {
          "_id": "664f...",
          "name": "John Doe",
          "color": "#6366f1",
          "initials": "JD",
          "status": "online"
        }
      ],
      "clientId": null,
      "location": "Conference Room A",
      "notes": "Discuss Q3 roadmap",
      "meetingLink": "https://meet.google.com/abc",
      "createdBy": "664f...",
      "createdAt": "2026-05-20T...",
      "updatedAt": "2026-05-23T..."
    }
  ]
}
```

---

### 7.2 Create Meeting

> Creates a new meeting. The `createdBy` field is automatically set to the authenticated user.
> Emits `meeting:created` socket event.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/meetings` |
| **Method** | `POST` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | `admin`, `manager` |

**📦 Request Body**

```json
{
  "title": "Sprint Planning",
  "type": "internal",
  "date": "2026-05-25",
  "time": "10:00",
  "duration": "60 min",
  "status": "upcoming",
  "participants": ["664f...", "664g..."],
  "clientId": null,
  "location": "Conference Room A",
  "notes": "Discuss Q3 roadmap",
  "meetingLink": "https://meet.google.com/abc"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | `string` | ✅ | — | Meeting title |
| `type` | `string` | ❌ | `"internal"` | One of: `client`, `internal`, `lead` |
| `date` | `string` | ✅ | — | Meeting date (e.g. `YYYY-MM-DD`) |
| `time` | `string` | ✅ | — | Meeting time (e.g. `10:00`) |
| `duration` | `string` | ❌ | `"60 min"` | Duration |
| `status` | `string` | ❌ | `"upcoming"` | One of: `upcoming`, `completed` |
| `participants` | `ObjectId[]` | ❌ | `[]` | Array of User ObjectIds |
| `clientId` | `ObjectId` | ❌ | `null` | Associated client |
| `location` | `string` | ❌ | `""` | Meeting location |
| `notes` | `string` | ❌ | `""` | Meeting notes |
| `meetingLink` | `string` | ❌ | `""` | Video call link |

**✅ Success Response** `201 Created`

```json
{
  "success": true,
  "data": { /* created meeting with populated participants & clientId */ }
}
```

**🔌 Socket Event:** `meeting:created` — broadcasts the populated meeting object.

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `400` | Missing title | `{ "success": false, "message": "Title is required" }` |
| `400` | Missing date | `{ "success": false, "message": "Date is required" }` |
| `400` | Missing time | `{ "success": false, "message": "Time is required" }` |
| `403` | Insufficient role | `{ "success": false, "message": "Role 'member' is not authorized for this action" }` |

---

### 7.3 Update Meeting

> Updates an existing meeting by ID.

| Field | Value |
|-------|-------|
| **Endpoint** | `PUT /api/meetings/:id` |
| **Method** | `PUT` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | `admin`, `manager` |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the meeting |

**📦 Request Body:** Any meeting fields to update (see Create Meeting).

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": { /* updated meeting object */ }
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `404` | Meeting not found | `{ "success": false, "message": "Meeting not found" }` |
| `403` | Insufficient role | `{ "success": false, "message": "Role 'member' is not authorized for this action" }` |

---

### 7.4 Delete Meeting

> Deletes a meeting by ID.

| Field | Value |
|-------|-------|
| **Endpoint** | `DELETE /api/meetings/:id` |
| **Method** | `DELETE` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | `admin`, `manager` |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the meeting |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "message": "Meeting deleted"
}
```

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `403` | Insufficient role | `{ "success": false, "message": "Role 'member' is not authorized for this action" }` |

---

## 8. Messages

> All message routes require authentication.
> Messages are organized by `threadId` (channel ID or `dm-<userId>` format).
> Socket events are emitted for real-time messaging.

### 8.1 Get Thread Messages

> Returns up to 200 messages for a given thread, sorted by creation date (oldest first).

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/messages/:threadId` |
| **Method** | `GET` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `threadId` | `string` | Thread/channel identifier (e.g. `general`, `dm-664f...`) |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "665f...",
      "threadId": "general",
      "userId": {
        "_id": "664f...",
        "name": "John Doe",
        "color": "#6366f1",
        "initials": "JD",
        "status": "online"
      },
      "text": "Hello team!",
      "attachments": [],
      "createdAt": "2026-05-23T10:30:00.000Z",
      "updatedAt": "2026-05-23T10:30:00.000Z"
    }
  ]
}
```

---

### 8.2 Send Message

> Sends a message to a thread. Supports text and up to 5 file attachments.
> Uses `multipart/form-data` content type when uploading files.
> Emits `message:new` socket event to the thread room.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/messages/:threadId` |
| **Method** | `POST` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |
| **Content-Type** | `multipart/form-data` |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `threadId` | `string` | Thread/channel identifier |

**📦 Request Body** (`multipart/form-data`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | ❌ (if files attached) | Message text content |
| `files` | `File[]` | ❌ (if text provided) | Up to 5 file attachments (max 10MB each) |

**Allowed File Types:**
- Images: `jpeg`, `png`, `gif`, `webp`
- Documents: `pdf`, `doc`, `docx`, `xls`, `xlsx`, `csv`, `txt`
- Archives: `zip`, `rar`
- Video: `mp4`, `quicktime`

**✅ Success Response** `201 Created`

```json
{
  "success": true,
  "data": {
    "_id": "665f...",
    "threadId": "general",
    "userId": {
      "_id": "664f...",
      "name": "John Doe",
      "color": "#6366f1",
      "initials": "JD",
      "status": "online"
    },
    "text": "Check this file",
    "attachments": [
      {
        "_id": "665f...",
        "name": "report.pdf",
        "size": 102400,
        "type": "application/pdf",
        "filename": "1716451200000-123456789.pdf",
        "url": "/uploads/1716451200000-123456789.pdf"
      }
    ],
    "createdAt": "2026-05-23T10:30:00.000Z",
    "updatedAt": "2026-05-23T10:30:00.000Z"
  }
}
```

**🔌 Socket Event:** `message:new` — emitted to room `threadId` with the populated message.

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `400` | Empty message (no text, no files) | `{ "success": false, "message": "Message cannot be empty" }` |
| `500` | File type not allowed | `{ "success": false, "message": "File type image/svg+xml not allowed" }` |

---

### 8.3 Delete Message

> Deletes a message by ID. Only the message owner or an admin can delete.
> Emits `message:deleted` socket event.

| Field | Value |
|-------|-------|
| **Endpoint** | `DELETE /api/messages/:id` |
| **Method** | `DELETE` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | Message owner or `admin` |

**🔗 URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | MongoDB ObjectId of the message |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "message": "Message deleted"
}
```

**🔌 Socket Event:** `message:deleted` — emitted to the thread room with `{ id, threadId }`.

**❌ Error Responses**

| Status | Condition | Response |
|--------|-----------|----------|
| `404` | Message not found | `{ "success": false, "message": "Message not found" }` |
| `403` | Not owner or admin | `{ "success": false, "message": "Not authorized" }` |

---

## 9. Reports

### 9.1 Get Report

> Returns aggregated task and todo data for a given time period. Members only see their own data. Admins/managers can filter by `userId`.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/reports` |
| **Method** | `GET` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**🔗 Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | `string` | ❌ | `"month"` | One of: `today`, `week`, `month`, `custom` |
| `userId` | `string` | ❌ | — | Filter by user (admin/manager only) |
| `from` | `string` | ❌ | — | Start date for `custom` period (e.g. `2026-05-01`) |
| `to` | `string` | ❌ | — | End date for `custom` period (e.g. `2026-05-31`) |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "_id": "665c...",
        "title": "Design homepage",
        "status": "completed",
        "priority": "high",
        "assignedTo": {
          "_id": "664f...",
          "name": "Jane Smith",
          "color": "#ec4899"
        },
        "dueDate": "2026-05-20",
        "createdAt": "2026-05-15T..."
      }
    ],
    "todos": [
      {
        "_id": "665d...",
        "title": "Review PR",
        "status": "completed",
        "userId": {
          "_id": "664f...",
          "name": "John Doe",
          "color": "#6366f1"
        },
        "createdAt": "2026-05-23T..."
      }
    ],
    "period": {
      "from": "2026-05-01T00:00:00.000Z",
      "to": "2026-05-31T00:00:00.000Z",
      "label": "month"
    },
    "summary": {
      "totalTasks": 25,
      "completedTasks": 18,
      "totalTodos": 42,
      "completedTodos": 35
    }
  }
}
```

---

## 10. Work Log

> All work log routes require authentication.
> Members only see their own logs.
> Admins/managers can filter by `userId`.

### 10.1 Get Work Logs

> Returns work logs sorted by date (newest first), limited to 100 entries.

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/worklog` |
| **Method** | `GET` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**🔗 Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | ❌ | Filter by user (admin/manager only) |

**📦 Request Body:** None

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "665g...",
      "userId": {
        "_id": "664f...",
        "name": "John Doe",
        "color": "#6366f1",
        "initials": "JD",
        "status": "online",
        "role": "admin"
      },
      "date": "2026-05-23",
      "workSeconds": 28800,
      "sessionStart": "2026-05-23T09:00:00.000Z",
      "breaks": [
        {
          "_id": "665h...",
          "type": "lunch",
          "reason": "Lunch break",
          "planned": 1800,
          "actual": 2100,
          "endedAt": "2026-05-23T13:35:00.000Z"
        }
      ],
      "active": true,
      "createdAt": "2026-05-23T09:00:00.000Z",
      "updatedAt": "2026-05-23T17:00:00.000Z"
    }
  ]
}
```

---

### 10.2 Upsert Work Log

> Creates or updates a work log entry for the authenticated user on a specific date.
> Uses `userId + date` as the unique key for upsert.

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/worklog` |
| **Method** | `POST` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**📦 Request Body**

```json
{
  "date": "2026-05-23",
  "workSeconds": 28800,
  "sessionStart": "2026-05-23T09:00:00.000Z",
  "breaks": [
    {
      "type": "lunch",
      "reason": "Lunch break",
      "planned": 1800,
      "actual": 2100,
      "endedAt": "2026-05-23T13:35:00.000Z"
    }
  ],
  "active": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `date` | `string` | ✅ | — | Date in `YYYY-MM-DD` format |
| `workSeconds` | `number` | ❌ | `0` | Total work seconds |
| `sessionStart` | `string` | ❌ | `""` | Session start timestamp |
| `breaks` | `object[]` | ❌ | `[]` | Array of break entries |
| `breaks[].type` | `string` | ❌ | — | Break type (e.g. `lunch`, `short`) |
| `breaks[].reason` | `string` | ❌ | — | Reason for break |
| `breaks[].planned` | `number` | ❌ | — | Planned break duration (seconds) |
| `breaks[].actual` | `number` | ❌ | — | Actual break duration (seconds) |
| `breaks[].endedAt` | `string` | ❌ | — | When the break ended |
| `active` | `boolean` | ❌ | `false` | Whether user is currently active |

**✅ Success Response** `200 OK`

```json
{
  "success": true,
  "data": { /* work log object with populated userId */ }
}
```

---

### 10.3 Set User Active Status

> Quick endpoint to toggle the user's active status in today's work log.
> Creates a new work log entry for today if one doesn't exist.

| Field | Value |
|-------|-------|
| **Endpoint** | `PATCH /api/worklog/active` |
| **Method** | `PATCH` |
| **Auth** | 🔒 Bearer Token |
| **Roles** | All authenticated users |

**📦 Request Body**

```json
{
  "active": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `active` | `boolean` | ✅ | Whether the user is currently active |

**✅ Success Response** `200 OK`

```json
{
  "success": true
}
```

---

## 11. WebSocket Events

> **Connection URL:** `ws://localhost:5000`
>
> **Authentication:** Pass the JWT access token via `socket.handshake.auth.token` or `Authorization` header.

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `join:thread` | `threadId: string` | Join a message thread room |
| `leave:thread` | `threadId: string` | Leave a message thread room |
| `typing:start` | `{ threadId: string }` | Notify thread that user is typing |
| `typing:stop` | `{ threadId: string }` | Notify thread that user stopped typing |
| `status:update` | `{ status: "online" \| "away" \| "offline" }` | Update user's online status |

### Server → Client Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `user:online` | `{ userId, name }` | User connects |
| `user:offline` | `{ userId }` | User disconnects |
| `user:status` | `{ userId, status }` | User changes status |
| `typing:start` | `{ userId, name, threadId }` | User starts typing |
| `typing:stop` | `{ userId, threadId }` | User stops typing |
| `task:created` | `Task object` | New task created via API |
| `task:updated` | `Task object` | Task updated via API |
| `task:deleted` | `taskId: string` | Task deleted via API |
| `meeting:created` | `Meeting object` | New meeting created via API |
| `message:new` | `Message object` | New message sent in a thread |
| `message:deleted` | `{ id, threadId }` | Message deleted from a thread |

---

## 12. Global Error Handling

All errors follow a consistent response format:

```json
{
  "success": false,
  "message": "Error description"
}
```

### Standard Error Codes

| Status | Condition | Example Message |
|--------|-----------|-----------------|
| `400` | Validation error | `"Name is required"` |
| `400` | Duplicate key | `"email already exists"` |
| `401` | Not authenticated | `"Not authenticated"` |
| `401` | Invalid / expired token | `"Invalid or expired token"` |
| `403` | Insufficient role | `"Role 'member' is not authorized for this action"` |
| `404` | Resource not found | `"Client not found"` |
| `404` | Invalid ObjectId | `"Resource not found"` |
| `404` | Route not found | `"Route not found"` |
| `500` | Server error | `"Server Error"` |

---

## Endpoint Summary Table

| # | Method | Endpoint | Auth | Roles | Description |
|---|--------|----------|------|-------|-------------|
| 1 | `GET` | `/api/health` | ❌ | — | Health check |
| 2 | `POST` | `/api/auth/login` | ❌ | — | Login |
| 3 | `POST` | `/api/auth/logout` | 🔒 | All | Logout |
| 4 | `POST` | `/api/auth/refresh` | 🍪 | — | Refresh token |
| 5 | `GET` | `/api/auth/me` | 🔒 | All | Current user |
| 6 | `PUT` | `/api/auth/profile` | 🔒 | All | Update profile |
| 7 | `PUT` | `/api/auth/password` | 🔒 | All | Change password |
| 8 | `GET` | `/api/users` | 🔒 | All | List users |
| 9 | `POST` | `/api/users` | 🔒 | A, M | Create user |
| 10 | `PUT` | `/api/users/:id` | 🔒 | A, M | Update user |
| 11 | `DELETE` | `/api/users/:id` | 🔒 | A, M | Delete user |
| 12 | `GET` | `/api/clients` | 🔒 | All | List clients |
| 13 | `GET` | `/api/clients/:id` | 🔒 | All | Get client |
| 14 | `POST` | `/api/clients` | 🔒 | A, M | Create client |
| 15 | `PUT` | `/api/clients/:id` | 🔒 | A, M | Update client |
| 16 | `DELETE` | `/api/clients/:id` | 🔒 | A, M | Delete client |
| 17 | `POST` | `/api/clients/:id/notes` | 🔒 | All | Add client note |
| 18 | `GET` | `/api/tasks` | 🔒 | All | List tasks |
| 19 | `POST` | `/api/tasks` | 🔒 | All | Create task |
| 20 | `PUT` | `/api/tasks/:id` | 🔒 | All | Update task |
| 21 | `DELETE` | `/api/tasks/:id` | 🔒 | A, M | Delete task |
| 22 | `GET` | `/api/todos` | 🔒 | All | List todos |
| 23 | `POST` | `/api/todos` | 🔒 | All | Create todo |
| 24 | `PUT` | `/api/todos/:id` | 🔒 | All | Update todo |
| 25 | `DELETE` | `/api/todos/:id` | 🔒 | All | Delete todo |
| 26 | `GET` | `/api/meetings` | 🔒 | All | List meetings |
| 27 | `POST` | `/api/meetings` | 🔒 | A, M | Create meeting |
| 28 | `PUT` | `/api/meetings/:id` | 🔒 | A, M | Update meeting |
| 29 | `DELETE` | `/api/meetings/:id` | 🔒 | A, M | Delete meeting |
| 30 | `GET` | `/api/messages/:threadId` | 🔒 | All | Get thread messages |
| 31 | `POST` | `/api/messages/:threadId` | 🔒 | All | Send message |
| 32 | `DELETE` | `/api/messages/:id` | 🔒 | Owner/A | Delete message |
| 33 | `GET` | `/api/reports` | 🔒 | All | Get report |
| 34 | `GET` | `/api/worklog` | 🔒 | All | Get work logs |
| 35 | `POST` | `/api/worklog` | 🔒 | All | Upsert work log |
| 36 | `PATCH` | `/api/worklog/active` | 🔒 | All | Set active status |

> **Legend:** 🔒 = Bearer Token, 🍪 = Cookie, A = Admin, M = Manager

---

*Generated on May 23, 2026 — AgencyOS CRM Backend v1.0.0*
