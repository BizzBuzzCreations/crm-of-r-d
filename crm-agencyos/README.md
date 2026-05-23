# AgencyOS CRM — Full Stack Setup Guide

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS + Zustand
- **Backend**: Node.js + Express.js
- **Database**: MongoDB (local or Atlas cloud)
- **Real-time**: Socket.io (messages, live task updates)
- **Auth**: JWT (access token + refresh token in httpOnly cookie)

---

## Prerequisites
- Node.js v18+
- MongoDB installed locally **OR** a free MongoDB Atlas account

---

## 1. MongoDB Setup

### Option A — Local MongoDB (Windows)
1. Download from https://www.mongodb.com/try/download/community
2. Install and start the service
3. Default URI: `mongodb://localhost:27017/agencyos`

### Option B — MongoDB Atlas (Cloud, Free)
1. Go to https://cloud.mongodb.com and create a free account
2. Create a free M0 cluster
3. Under **Database Access**, add a user with password
4. Under **Network Access**, add `0.0.0.0/0` (allow all IPs)
5. Click **Connect** → **Drivers** → copy the connection string
   - Replace `<password>` with your user's password
   - Example: `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/agencyos`

---

## 2. Backend Setup

```bash
cd crm-agencyos/backend

# Install dependencies
npm install

# Copy env file and fill in values
copy .env.example .env
```

Edit `backend/.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/agencyos
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRE=15m
JWT_REFRESH_SECRET=another_long_random_string
JWT_REFRESH_EXPIRE=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

```bash
# Seed the database with demo accounts
npm run seed

# Start the backend server
npm run dev
```

Backend will run on: http://localhost:5000

---

## 3. Frontend Setup

```bash
cd crm-agencyos

# The .env file is already created
# Make sure it points to your backend:
# VITE_API_URL=http://localhost:5000/api
# VITE_SOCKET_URL=http://localhost:5000

# Fix the rollup issue (Windows)
rmdir /s /q node_modules
del package-lock.json
npm cache clean --force
npm install

# Start frontend
npm run dev
```

Frontend will run on: http://localhost:5173

---

## 4. Demo Accounts

After seeding, these accounts work:

| Role    | Email                  | Password    |
|---------|------------------------|-------------|
| Admin   | admin@agency.com       | admin123    |
| Manager | manager@agency.com     | manager123  |
| Member  | member@agency.com      | member123   |

---

## 5. API Endpoints

| Method | Route                        | Description              |
|--------|------------------------------|--------------------------|
| POST   | /api/auth/login              | Login                    |
| POST   | /api/auth/logout             | Logout                   |
| POST   | /api/auth/refresh            | Refresh access token     |
| GET    | /api/auth/me                 | Get current user         |
| GET    | /api/users                   | Get all users            |
| POST   | /api/users                   | Create user (admin/mgr)  |
| DELETE | /api/users/:id               | Delete user (admin/mgr)  |
| GET    | /api/clients                 | Get all clients          |
| POST   | /api/clients                 | Create client            |
| PUT    | /api/clients/:id             | Update client            |
| DELETE | /api/clients/:id             | Delete client            |
| POST   | /api/clients/:id/notes       | Add note to client       |
| GET    | /api/tasks                   | Get tasks                |
| POST   | /api/tasks                   | Create task              |
| PUT    | /api/tasks/:id               | Update task              |
| DELETE | /api/tasks/:id               | Delete task              |
| GET    | /api/todos                   | Get todos                |
| POST   | /api/todos                   | Create todo              |
| PUT    | /api/todos/:id               | Update todo              |
| DELETE | /api/todos/:id               | Delete todo              |
| GET    | /api/meetings                | Get meetings             |
| POST   | /api/meetings                | Create meeting           |
| PUT    | /api/meetings/:id            | Update meeting           |
| DELETE | /api/meetings/:id            | Delete meeting           |
| GET    | /api/messages/:threadId      | Get thread messages      |
| POST   | /api/messages/:threadId      | Send message + files     |
| DELETE | /api/messages/:id            | Delete message           |
| GET    | /api/reports                 | Get reports data         |
| GET    | /api/worklog                 | Get work logs            |
| POST   | /api/worklog                 | Save work log entry      |

---

## 6. Socket.io Events

| Event          | Direction       | Description                    |
|----------------|-----------------|--------------------------------|
| join:thread    | client → server | Join a message channel/DM      |
| leave:thread   | client → server | Leave a channel/DM             |
| typing:start   | client → server | User started typing            |
| typing:stop    | client → server | User stopped typing            |
| message:new    | server → client | New message received           |
| message:deleted| server → client | Message was deleted            |
| task:created   | server → client | New task created               |
| task:updated   | server → client | Task was updated               |
| task:deleted   | server → client | Task was deleted               |
| meeting:created| server → client | New meeting scheduled          |
| user:online    | server → client | User came online               |
| user:offline   | server → client | User went offline              |
| user:status    | server → client | User status changed            |

---

## Project Structure

```
crm-agencyos/
├── backend/              ← Node.js/Express backend
│   ├── src/
│   │   ├── config/       ← DB connection
│   │   ├── middleware/   ← Auth, error handler, upload
│   │   ├── models/       ← MongoDB/Mongoose models
│   │   ├── controllers/  ← Route handlers
│   │   ├── routes/       ← Express routers
│   │   └── socket/       ← Socket.io handler
│   ├── uploads/          ← Uploaded files stored here
│   ├── .env              ← Your config (create from .env.example)
│   └── server.js         ← Entry point
├── src/                  ← React frontend
│   ├── pages/
│   ├── components/
│   ├── store/            ← Zustand (connected to API)
│   ├── services/api.js   ← Axios API client
│   └── ...
├── .env                  ← Frontend config
└── package.json
```
