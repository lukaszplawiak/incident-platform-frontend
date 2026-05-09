# Incident Platform — Frontend

[![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-4-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Nginx](https://img.shields.io/badge/Nginx-Alpine-009639?logo=nginx&logoColor=white)](https://nginx.org/)
[![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-2563eb)](LICENSE)

Angular 21 SPA companion to the [Incident Platform](https://github.com/lukaszplawiak/incident-platform) backend — a production-grade Java/Spring Boot microservices system. Built to demonstrate full-stack capability with modern Angular patterns: Signals, standalone components, and real-time WebSocket updates.

[Overview](#overview) | [Architecture](#architecture) | [Design Decisions](#design-decisions) | [Tech Stack](#tech-stack) | [Resilience & Security](#resilience--security) | [Running Locally](#running-locally) | [Docker](#docker) | [Running Tests](#running-tests) | [Project Structure](#project-structure)

---

## Overview

A real-time incident management dashboard that consumes the Incident Platform REST and WebSocket APIs. Operators monitor, filter, sort, acknowledge and resolve incidents — with live updates pushed over WebSocket without polling.

### What the frontend covers

- **Real-time dashboard** — incident list updated live via STOMP over WebSocket, automatic fallback to polling when WebSocket is offline
- **Incident lifecycle** — acknowledge and resolve incidents with optimistic UI updates and automatic rollback on error
- **Filtering and pagination** — filter by severity and status, server-side sort by severity, title, status or age, server-side pagination
- **Incident detail** — audit log timeline and AI-generated postmortem draft per incident
- **Session management** — dual logout mechanism: token expiry timer + idle detection with countdown warning and extend option
- **Toast notifications** — feedback for every state change, error, and WebSocket connection event

---

## Architecture

```
src/app/
├── core/                          # Application-wide singletons
│   ├── guards/                    # authGuard — CanActivateFn
│   ├── handlers/                  # GlobalErrorHandler — unhandled errors → /error
│   ├── interceptors/              # authInterceptor, errorInterceptor
│   ├── models/                    # TypeScript interfaces (domain types)
│   └── services/
│       ├── auth.service.ts        # JWT decode, Signals state, token expiry timer
│       ├── incident.service.ts    # Signals state management + HTTP + server-side sort
│       ├── websocket.service.ts   # STOMP client, reconnect, event routing
│       ├── idle.service.ts        # Activity monitoring, idle timeout
│       └── logger.service.ts     # Leveled console logger (DEBUG/INFO/WARN/ERROR)
│
├── features/
│   ├── auth/login/                # Login form — token input
│   ├── errors/                    # /error and /forbidden pages
│   └── incidents/
│       ├── dashboard/             # Main view — orchestrates all children
│       ├── incident-detail/       # Detail + audit log + postmortem tabs
│       ├── incident-list/         # Table with sort headers (OnPush)
│       ├── incident-filter/       # Reactive form filter (OnPush)
│       ├── incident-pagination/   # Page controls (OnPush)
│       ├── incident-row/          # Single table row (OnPush)
│       ├── incident-audit/        # Audit log tab
│       └── incident-postmortem/   # Postmortem tab
│
└── shared/
    └── components/
        ├── severity-badge/        # input.required<T>() + computed CSS class
        ├── status-badge/          # input.required<T>() + computed CSS class
        └── toast/                 # Notification overlay service + component
```

### State Management

No NgRx — state is managed with Angular Signals directly in services. Signals expose readonly state to components; WebSocket events and HTTP responses update state in-place:

```typescript
// Readonly state exposed to components
readonly incidents = this._incidents.asReadonly();
readonly criticalCount = computed(() =>
  this._incidents().filter(i => i.severity === 'CRITICAL').length
);

// WebSocket event updates state without polling
addIncident(incident: Incident): void {
  const exists = this._incidents().some(i => i.id === incident.id);
  if (exists) return;
  this._incidents.update(list => [incident, ...list]);
  this._totalElements.update(n => n + 1);
}
```

### Optimistic Updates

Status changes are applied immediately to the UI. If the server returns an error, the previous state is restored automatically:

```typescript
updateStatus(id: string, request: UpdateStatusRequest): void {
  const previousIncidents = this._incidents();      // snapshot
  this.applyOptimisticUpdate(id, request.status);   // update UI immediately

  this.http.patch(url, request).subscribe({
    next: updated => { /* apply server response */ },
    error: () => {
      this._incidents.set(previousIncidents);        // rollback
      this.toastService.error('Update failed');
    }
  });
}
```

### Allowed Transitions

The backend FSM returns `allowedTransitions` on every incident response — the exact set of status transitions permitted from the current state. The frontend uses this field directly instead of re-implementing FSM rules locally:

```typescript
get canAcknowledge(): boolean {
  if (this.incident.allowedTransitions) {
    return this.incident.allowedTransitions.includes('ACKNOWLEDGED');
  }
  // Fallback for WebSocket events that may not include allowedTransitions
  return this.incident.status === 'OPEN' || this.incident.status === 'ESCALATED';
}
```

This means backend FSM changes propagate automatically to the UI without any frontend code change.

### WebSocket Flow

```
STOMP connect → subscribe /topic/incidents/{tenantId}
      │
      ├── INCIDENT_CREATED   → incidentService.addIncident()
      └── INCIDENT_UPDATED / INCIDENT_STATUS_CHANGED → incidentService.updateIncident()

Disconnected → exponential backoff reconnect (1s → 2s → 4s → max 30s)
             → fallback to HTTP polling every 30s
             → visual indicator: Connected / Reconnecting / Offline
```

---

## Design Decisions

**Why Angular Signals instead of NgRx?**
NgRx adds significant boilerplate (actions, reducers, selectors, effects) for a dashboard of this scope. Angular Signals provide fine-grained reactivity with less code and full integration with Angular change detection. The `computed()` primitive replaces selectors; `effect()` replaces effects for WebSocket subscriptions. Migration to NgRx would require changing only the service layer — components consume readonly signals regardless of what manages them.

**Why `OnPush` change detection on all list components?**
The incident list can contain many rows. With default change detection, every Angular check cycle re-evaluates every component in the tree. `OnPush` limits re-rendering to when Signal inputs change — a row only re-renders when its specific incident object changes, not when any other incident in the list changes.

**Why optimistic updates instead of waiting for the server?**
Acknowledge and resolve are the most frequent user actions. Waiting for the server response before updating the UI makes the dashboard feel slow. Optimistic update applies the change immediately and rolls back silently if the server returns an error — the user sees correct state in both success and failure cases.

**Why server-side sorting instead of client-side?**
Client-side sorting (Array.sort) operates only on the current page. With server-side pagination this means clicking a sort header sorts 20 rows, not the full dataset. Sort parameters are passed as query params to the backend (`sort=severity&direction=desc`) which applies them across the entire dataset before paginating.

**Why `allowedTransitions` from the backend instead of local FSM rules?**
The backend defines the FSM. Duplicating transition rules in the frontend creates two sources of truth that can diverge silently — if the backend adds a new transition or removes one, the frontend would show incorrect action buttons. Using `allowedTransitions` from the API response makes the UI automatically correct regardless of FSM changes.

**Why two independent logout timers?**
`AuthService.autoLogoutTimer` handles absolute token expiry — it fires at `min(tokenExpiry, inactivityTimeout)` and is reset on every authenticated HTTP request. `IdleService.idleTimer` handles inactivity — it fires after a period with no user interaction events and is reset on every mouse/keyboard/touch event. Either can fire first. Both call `authService.logout()` — the second call is a safe no-op because `logout()` clears the token and navigates to `/login`.

**Why STOMP over raw WebSocket?**
Raw WebSocket is a transport — it has no concept of topics, subscriptions, or acknowledgment. STOMP adds a lightweight pub/sub layer: the frontend subscribes to `/topic/incidents/{tenantId}` and only receives events for its own tenant. The backend Spring WebSocket broker handles routing.

**Why JWT in `sessionStorage` instead of `localStorage` or cookies?**
`localStorage` persists across tabs and survives browser close — a lost laptop with an open browser means an active session. `sessionStorage` is tab-isolated and cleared on tab close. HttpOnly cookies would be most secure but require backend CORS and cookie configuration changes. `sessionStorage` is a documented tradeoff for a portfolio context.

**Why a leveled `LoggerService` instead of `console.log`?**
Direct `console.log` calls cannot be suppressed without removing them from source. `LoggerService` wraps console methods with a minimum log level — in production the level is set to `WARN`, suppressing all `DEBUG` and `INFO` output without code changes.

**Why Vitest instead of Karma/Jasmine?**
Vitest runs in Node.js with jsdom — no browser launch, no Karma server. Test runs are significantly faster and integrate with the Angular 21 `@angular/build:unit-test` builder natively. The API is Jest-compatible: `vi.useFakeTimers()` and `vi.mock()` work without additional setup.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Angular 21 — standalone components, Signals | Fine-grained reactivity without NgRx boilerplate |
| Language | TypeScript 5.9, strict mode | Type safety across all service and component boundaries |
| Reactive | Angular Signals, `computed()`, `toSignal()` | Replaces NgRx for state, integrates with change detection |
| Real-time | STOMP over WebSocket (`@stomp/stompjs`) | Pub/sub topics, tenant-scoped subscriptions |
| HTTP | Angular `HttpClient`, functional interceptors | Composable auth and error handling without class decorators |
| Forms | Angular Reactive Forms | Typed form controls, `valueChanges` stream for filter debounce |
| Change Detection | `OnPush` on all list components | Prevents unnecessary re-renders in large incident lists |
| Signal Inputs | `input.required<T>()` on all leaf components | Reactive, type-safe, consistent — no `@Input()` decorator pattern |
| Testing | Vitest 4 via `@angular/build:unit-test` | Fast Node.js runner, no browser launch, Jest-compatible API |
| Linting | ESLint + `angular-eslint` + `typescript-eslint` | Angular-specific rules, strict TypeScript enforcement |
| Container | Docker multi-stage (Node 20 builder + Nginx Alpine) | ~50MB final image, no Node.js in production |
| Server | Nginx with security headers, gzip, SPA routing | Content-hashed asset caching, `no-store` for `index.html` |

---

## Resilience & Security

### WebSocket Resilience

- **Exponential backoff reconnect**: 1s → 2s → 4s → ... → max 30s — recovers from network interruptions without hammering the server
- **Automatic polling fallback**: when WebSocket is offline, falls back to HTTP polling every 30 seconds — dashboard stays usable
- **Visual connection indicator**: operators always know whether they are seeing live data (Connected / Reconnecting / Offline)

### HTTP Resilience

- **Retry with exponential backoff**: `errorInterceptor` retries on HTTP 503 and network errors — transient backend restarts don't surface to the user
- **Optimistic update rollback**: failed acknowledge/resolve requests restore the previous incident state automatically
- **Skeleton loading states**: components show placeholders during data fetch — no layout shift on load

### Session Security

- **JWT in `sessionStorage`**: tab-isolated, cleared on tab close — no cross-tab session sharing
- **`authInterceptor`**: attaches `Authorization: Bearer` only to configured backend origins — token never sent to third-party URLs
- **Dual logout mechanism**:
  - Token expiry timer in `AuthService` — absolute upper bound, reset on every authenticated HTTP request
  - Idle detection in `IdleService` — fires after configurable inactivity, reset on every user interaction event
- **HTTP 401**: clears session and redirects to login
- **HTTP 403**: redirects to `/forbidden` page

### Application Security

- **`GlobalErrorHandler`**: catches all unhandled Angular errors and redirects to `/error` — no raw stack traces exposed to the user
- **Open redirect protection**: `getSafeRedirectUrl()` in login validates the redirect param starts with `/` and not `//`
- **Nginx security headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Content-Security-Policy`, `server_tokens off`
- **Asset caching strategy**: static JS/CSS cached 1 year (content-hashed filenames), `index.html` never cached (`no-store`) — stale assets never served after deployment

---

## Running Locally

### Prerequisites

- Node.js 20+
- Running [Incident Platform backend](https://github.com/lukaszplawiak/incident-platform) — see backend README for setup instructions

### Step 1 — Install dependencies

```bash
npm install
```

### Step 2 — Start the dev server

```bash
ng serve
# or
npm start
```

App runs at `http://localhost:4200`. API calls are proxied to the backend services:
- `http://localhost:8081` — ingestion-service (auth token endpoint)
- `http://localhost:8082` — incident-service (incidents, WebSocket)
- `http://localhost:8086` — oncall-service

### Step 3 — Log in

Generate a dev token from the backend (local profile only):

```bash
curl -s "http://localhost:8082/dev/token?\
userId=11111111-1111-1111-1111-111111111111\
&tenantId=test-tenant\
&email=admin@test.com\
&roles=ROLE_ADMIN" | jq -r .token
```

Copy the token and paste it into the login form at `http://localhost:4200/login`.

> In local dev the login form pre-fills `userId` and `tenantId` from `environment.devDefaults` for convenience. These values are absent in the production environment — the form starts empty.

### Step 4 — Build for production

```bash
ng build --configuration production
# or
npm run build
```

Output in `dist/incident-platform-frontend/browser/`.

---

## Docker

### Build and run

```bash
# Build image
docker build -t incident-platform-frontend .

# Run
docker run -p 80:80 incident-platform-frontend
```

App available at `http://localhost`.

### Multi-stage build

The Dockerfile produces a ~50MB image with no Node.js in the final image:

```
Stage 1 — Node 20 Alpine (builder)
  npm ci --omit=dev
  ng build --configuration production

Stage 2 — Nginx Alpine (runtime)
  static files from Stage 1 only
  nginx.conf (SPA routing, gzip, caching)
  security-headers.conf
```

### Nginx configuration highlights

- **SPA routing**: all paths fall back to `index.html` — client-side routes work on direct load and refresh
- **Static asset caching**: JS, CSS, fonts cached for 1 year — Angular appends content hashes to filenames, so the cache is always correct after deployment
- **`index.html` never cached**: `Cache-Control: no-cache, no-store` — users always get the latest entry point pointing to current hashed assets
- **Gzip**: enabled for JS, CSS, JSON, SVG — reduces transfer size for text assets
- **Security headers in every `location {}`**: Nginx does not inherit `add_header` from `server {}` when a `location {}` defines its own `add_header` — headers are repeated explicitly in each block to guarantee they are sent for every response
- **`server_tokens off`**: Nginx version not exposed in response headers

---

## Running Tests

```bash
# All tests, single run
ng test --watch=false

# Watch mode during development
ng test

# Single spec file
ng test --watch=false --include="**/auth.service.spec.ts"
```

### What is tested

Unit tests cover business logic — not templates, not CSS, not Angular internals.

| Test | What it covers |
|---|---|
| `auth.service.spec.ts` | JWT decode, Signal state, auto-logout timer, session expiry |
| `incident.service.spec.ts` | Signal state management, HTTP params, optimistic update rollback, server-side sort params, WebSocket add/update |
| `websocket.service.spec.ts` | STOMP mock, connection states, event routing, reconnect logic, invalid message handling |
| `idle.service.spec.ts` | Timer logic, activity detection, countdown |
| `logger.service.spec.ts` | Log level filtering — DEBUG suppressed in production |
| `auth.guard.spec.ts` | `UrlTree` redirect vs boolean return |
| `auth.interceptor.spec.ts` | Bearer token attachment, external URL exclusion, timer reset on authenticated requests |
| `error.interceptor.spec.ts` | Retry logic for 503 and network errors, 401/403 side effects, user-friendly messages for all status codes |
| `severity-badge.spec.ts` | Signal `input.required` + `computed()` CSS class outputs |
| `status-badge.spec.ts` | Signal `input.required` + `computed()` CSS class outputs |

**Tools**: Vitest 4 · `HttpTestingController` for HTTP · `vi.useFakeTimers()` for timers · `vi.mock()` for STOMP client

**Not unit tested** (covered by backend E2E or manual): dashboard composition, template rendering, routing integration.

---

## Project Structure

```
incident-platform-frontend/
├── src/
│   ├── app/
│   │   ├── app.ts                 # Root component
│   │   ├── app.config.ts          # provideRouter, provideHttpClient, interceptors, GlobalErrorHandler
│   │   ├── app.routes.ts          # Lazy-loaded routes: /login, /incidents, /incidents/:id, /error, /forbidden
│   │   │
│   │   ├── core/
│   │   │   ├── guards/
│   │   │   │   └── auth.guard.ts              # Redirects unauthenticated users to /login
│   │   │   ├── handlers/
│   │   │   │   └── global-error.handler.ts    # Catches unhandled errors → /error
│   │   │   ├── interceptors/
│   │   │   │   ├── auth.interceptor.ts        # Attaches Bearer token to backend requests only
│   │   │   │   └── error.interceptor.ts       # Retry, 401/403 redirect, user-friendly messages
│   │   │   ├── models/
│   │   │   │   ├── incident.model.ts          # Incident (with allowedTransitions), IncidentFilter (with sort params)
│   │   │   │   ├── audit-event.model.ts       # AuditEvent, AuditEventType
│   │   │   │   ├── postmortem.model.ts        # Postmortem, PostmortemStatus
│   │   │   │   └── auth.model.ts              # AuthResponse, JwtPayload
│   │   │   └── services/
│   │   │       ├── auth.service.ts            # JWT parse, isAuthenticated signal, dual logout timer
│   │   │       ├── incident.service.ts        # incidents signal, HTTP CRUD, optimistic update, server-side sort
│   │   │       ├── websocket.service.ts       # STOMP connect/reconnect, tenant subscription, backoff
│   │   │       ├── idle.service.ts            # Inactivity timer, session extension
│   │   │       └── logger.service.ts          # Leveled logger — WARN level in production
│   │   │
│   │   ├── features/
│   │   │   ├── auth/login/
│   │   │   │   └── login.ts                   # Token input form, dev defaults from environment
│   │   │   ├── errors/
│   │   │   │   ├── error/error.ts             # Generic error page
│   │   │   │   └── forbidden/forbidden.ts     # HTTP 403 page
│   │   │   └── incidents/
│   │   │       ├── dashboard/dashboard.ts     # Orchestrator: filter + sort + page state, WS lifecycle
│   │   │       ├── incident-detail/           # Detail view with audit + postmortem, signal input id
│   │   │       ├── incident-list/             # Table, sort headers, OnPush
│   │   │       ├── incident-filter/           # Reactive form filter, debounced valueChanges, OnPush
│   │   │       ├── incident-pagination/       # Page size + page number controls, OnPush
│   │   │       ├── incident-row/              # Single row, OnPush, allowedTransitions-based action buttons
│   │   │       ├── incident-audit/            # Chronological audit event list
│   │   │       └── incident-postmortem/       # Postmortem draft display
│   │   │
│   │   └── shared/
│   │       └── components/
│   │           ├── severity-badge/            # CRITICAL/HIGH/MEDIUM/LOW — input.required + computed
│   │           ├── status-badge/              # OPEN/ACKNOWLEDGED/RESOLVED/CLOSED — input.required + computed
│   │           └── toast/                     # Toast service + overlay component
│   │
│   ├── environments/
│   │   ├── environment.ts         # Development: API URLs, log level DEBUG, devDefaults for login form
│   │   └── environment.prod.ts    # Production: API URLs, log level WARN — no devDefaults
│   └── styles.scss                # Global styles
│
├── Dockerfile                     # Multi-stage: Node 20 builder + Nginx Alpine runtime (~50MB)
├── nginx.conf                     # SPA routing, gzip, asset caching strategy
├── security-headers.conf          # X-Frame-Options, CSP, Referrer-Policy, X-Content-Type-Options
├── angular.json                   # Build, test (Vitest), lint configuration
├── tsconfig.json                  # TypeScript strict mode + Angular compiler options
└── eslint.config.js               # ESLint + angular-eslint + typescript-eslint rules
```

---

## Backend

This frontend requires the [Incident Platform backend](https://github.com/lukaszplawiak/incident-platform) — a Java 21 / Spring Boot 3.5 microservices system with Kafka, PostgreSQL, Redis, and Kubernetes deployment. See the backend README for full setup instructions.

The primary portfolio focus is the backend. This SPA demonstrates the ability to work across the full stack with modern Angular patterns.

---

## License

MIT