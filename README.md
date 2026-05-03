# 📊 Incident Platform – Frontend

Frontend application for the **Incident Platform**, a production-grade distributed system for incident detection, escalation, and resolution.

This UI provides a real-time operational dashboard for engineers to monitor, filter, and react to incidents across multiple tenants.

It is a **presentation layer** built on top of a backend system responsible for:
- alert ingestion
- incident lifecycle management
- escalation chains
- notifications (Slack / Email / SMS)
- AI-generated postmortems

---

## 🧠 System Context

This frontend is part of a larger microservices architecture:

- ingestion-service (alert normalization & deduplication)
- incident-service (core incident lifecycle engine)
- escalation-service (automatic escalation system)
- notification-service (multi-channel delivery)
- oncall-service (on-call scheduling)
- postmortem-service (AI-assisted postmortems)

### Communication model
- REST API → incident-service
- WebSocket (STOMP over `/ws`) → real-time updates
- JWT-based authentication

---

## 🎯 Frontend Responsibilities

The frontend focuses on **operational visibility and fast incident response**.

### Core features

- 🔐 Authentication (JWT login)
- 📊 Real-time incident dashboard
- 🔍 Filtering:
  - status (OPEN, ACKNOWLEDGED, RESOLVED, CLOSED)
  - severity (CRITICAL, HIGH, MEDIUM, LOW)
- ⚡ Live updates via WebSocket (STOMP)
- 📄 Incident detail view
- 🧾 Audit timeline per incident
- 📱 Responsive UI for operational usage

---

## ⚙️ Tech Stack

- Angular (standalone architecture)
- TypeScript
- RxJS
- STOMP (`@stomp/stompjs`)
- SCSS
- Vitest (unit testing)
- ESLint (strict configuration)

---

## 🏗 Architecture Overview

Feature-based modular structure:
app/
├── core/ → infrastructure (services, guards, interceptors)
├── features/ → business modules (auth, incidents, errors)
└── shared/ → reusable UI components


### Key design principles
- separation of concerns
- feature-first architecture
- backend-driven state
- reactive UI (RxJS + WebSocket)

---

## 🧩 Core Layer

Handles application infrastructure:

### Services
- **AuthService** → JWT handling & session state
- **IncidentService** → REST API communication
- **WebSocketService** → STOMP lifecycle + real-time updates
- **LoggerService** → centralized logging abstraction
- **IdleService** → inactivity tracking & auto logout

### Infrastructure
- **AuthGuard** → route protection
- **HTTP Interceptors**
  - auth token injection
  - global error handling (401/403/5xx)

---

## 📦 Features

### 📊 Incidents Module

Main operational dashboard:

- incident list view
- filtering by status & severity
- pagination
- real-time updates
- incident details
- audit trail timeline
- postmortem preview

### 🔐 Auth Module

- login page
- JWT session initialization

### ⚠️ Error Module

- 403 Forbidden page
- global error fallback page

---

## 🔄 Real-time Updates (WebSocket)

STOMP over WebSocket:
/topic/incidents/{tenantId}


### Event types
- INCIDENT_CREATED
- INCIDENT_UPDATED
- STATUS_CHANGED

UI updates are applied instantly without refresh.

---

## 🔐 Authentication Flow

- login via backend endpoint
- JWT stored in `sessionStorage`
- token decoded for:
  - userId
  - tenantId
  - roles
- route protection via `AuthGuard`
- automatic logout:
  - token expiration
  - inactivity timeout

---

## ⏱ Idle Session Handling

Automatic logout system:

- global activity tracking (mouse / keyboard)
- timer reset on interaction
- configurable timeout (`autoLogoutMinutes`)

---

## 📡 API Communication

- Angular `HttpClient`
- global error interceptor:
  - 401 → logout
  - 403 → redirect to forbidden page
  - 5xx → user-friendly fallback
- retry strategy for unstable network responses

---

## 🧪 Testing

- Vitest (unit tests)
- coverage:
  - services
  - guards
  - interceptors
  - WebSocket layer

### Mocking strategy
- HTTP backend
- STOMP client
- Router
- Auth state

Run tests:

```bash
npm run test