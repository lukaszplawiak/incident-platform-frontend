# Incident Platform — Frontend

> Angular 21 SPA for the [Incident Platform](https://github.com/your-username/incident-platform) backend.
> Built to demonstrate full-stack capability alongside a production-grade Java/Spring Boot microservices backend.

---

## Overview

A real-time incident management dashboard that consumes the Incident Platform REST and WebSocket APIs. Operators can monitor, filter, sort, acknowledge and resolve incidents — with live updates pushed over WebSocket without polling.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Angular 21 — standalone components, Signals |
| Language | TypeScript 5.9, strict mode |
| Reactive | RxJS 7.8, Angular Signals, `toSignal()` |
| Real-time | STOMP over WebSocket (`@stomp/stompjs`) |
| HTTP | Angular `HttpClient`, functional interceptors |
| Forms | Angular Reactive Forms |
| Testing | Vitest 4 via `@angular/build:unit-test` |
| Linting | ESLint + `angular-eslint` + `typescript-eslint` |
| Container | Docker multi-stage build — Node builder + Nginx Alpine runtime |
| Server | Nginx with security headers, gzip, SPA routing, aggressive asset caching |

---

## Features

### Real-time Dashboard
- Live incident list with WebSocket updates — no manual refresh needed
- Automatic fallback to polling every 30 seconds when WebSocket is offline
- WebSocket exponential backoff reconnect (1s → 2s → 4s → max 30s)
- Visual connection state indicator (Connected / Reconnecting / Offline)

### Incident Management
- Filter by severity (Critical / High / Medium / Low) and status
- Client-side sorting by severity, title, status, opened date
- Server-side pagination
- Acknowledge / Resolve with optimistic UI update and automatic rollback on error
- Incident detail view with audit log and postmortem

### Security
- JWT stored in `sessionStorage` (tab-isolated, cleared on close)
- Auth interceptor attaches `Authorization: Bearer` only to backend requests
- Idle detection — auto-logout after configurable inactivity period
- Session expiry warning with countdown and extend option
- Global error handler — unhandled errors redirect to `/error`
- HTTP 401 → logout, HTTP 403 → `/forbidden`

### UX
- Toast notifications for all state changes
- Skeleton loading states
- Retry with exponential backoff for HTTP 503 and network errors
- User-friendly error messages (no raw HTTP status codes exposed)

---

## Architecture

```
src/app/
├── core/
│   ├── guards/          # authGuard — CanActivateFn
│   ├── handlers/        # GlobalErrorHandler
│   ├── interceptors/    # authInterceptor, errorInterceptor
│   ├── models/          # TypeScript interfaces (domain types)
│   └── services/
│       ├── auth.service.ts        # JWT decode, Signals state, auto-logout
│       ├── incident.service.ts    # Signals state management + HTTP
│       ├── websocket.service.ts   # STOMP client, reconnect, event routing
│       ├── idle.service.ts        # Activity monitoring, idle timeout
│       └── logger.service.ts      # Leveled console logger (DEBUG/INFO/WARN/ERROR)
│
├── features/
│   ├── auth/login/
│   ├── errors/          # forbidden, error pages
│   └── incidents/
│       ├── dashboard/           # Main view — orchestrates all children
│       ├── incident-detail/     # Detail + audit log + postmortem
│       ├── incident-list/       # Table with sort headers (OnPush)
│       ├── incident-filter/     # Reactive form filter (OnPush)
│       ├── incident-pagination/ # Page controls (OnPush)
│       ├── incident-row/        # Single table row (OnPush)
│       ├── incident-audit/      # Audit log tab
│       └── incident-postmortem/ # Postmortem tab
│
└── shared/
    └── components/
        ├── severity-badge/   # Signal input + computed
        ├── status-badge/     # Signal input + computed
        └── toast/            # Notification overlay
```

### State Management

No NgRx — state is managed with Angular Signals directly in services:

```typescript
// Signals expose readonly state
readonly incidents = this._incidents.asReadonly();
readonly criticalCount = computed(() =>
  this._incidents().filter(i => i.severity === 'CRITICAL').length
);

// WebSocket events update state in-place
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

---

## Getting Started

### Prerequisites

- Node.js 20+
- Running [Incident Platform backend](https://github.com/your-username/incident-platform)

### Development

```bash
npm install
ng serve
```

App runs at `http://localhost:4200`. Proxies API calls to `localhost:8081` / `8082` / `8086`.

### Login

The backend exposes a dev token endpoint:

```bash
curl "http://localhost:8082/dev/token?tenantId=acme-corp&role=ROLE_ADMIN"
```

Copy the token, paste it into the login form.

### Run Tests

```bash
# All tests
ng test --watch=false

# Single file
ng test --watch=false --include="**/auth.service.spec.ts"
```

### Build

```bash
ng build --configuration production
```

Output in `dist/incident-platform-frontend/browser/`.

---

## Docker

```bash
# Build image
docker build -t incident-platform-frontend .

# Run
docker run -p 80:80 incident-platform-frontend
```

The multi-stage Dockerfile produces a ~50 MB image:
- **Stage 1** — Node 20 Alpine: `npm ci` + `ng build --configuration production`
- **Stage 2** — Nginx Alpine: serves static files only, no Node.js in the final image

### Nginx Configuration

- SPA routing — all paths fall back to `index.html`
- Static assets cached for 1 year (content-hashed filenames)
- `index.html` never cached (`no-store`)
- Gzip compression for JS, CSS, JSON, SVG
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`
- `server_tokens off` — Nginx version not exposed

---

## Testing Strategy

Unit tests cover business logic — not templates, not CSS, not Angular internals.

| What | Why |
|---|---|
| `AuthService` | JWT decode, signal state, auto-logout timer |
| `IncidentService` | Signal state management, HTTP params, optimistic update rollback |
| `WebSocketService` | STOMP mock, connection states, event routing, reconnect |
| `IdleService` | Timer logic, activity detection |
| `LoggerService` | Log level filtering |
| `authGuard` | UrlTree redirect vs boolean return |
| `authInterceptor` | Bearer token attachment, external URL exclusion |
| `errorInterceptor` | Retry logic, 401/403 side effects, user-friendly messages |
| `SeverityBadge` | Signal computed outputs |
| `StatusBadge` | Signal computed outputs |

**Not unit tested** (covered by backend E2E / manual): Dashboard composition, template rendering, routing.

**Tools:** Vitest 4 via `@angular/build:unit-test` · `HttpTestingController` for HTTP · `vi.useFakeTimers()` for timers · `vi.mock()` for STOMP client

---

## Project Context

This frontend is a companion to the [Incident Platform backend](https://github.com/your-username/incident-platform) — a Java 21 / Spring Boot 3.5 microservices system with Kafka, PostgreSQL, Redis, ShedLock and Kubernetes deployment.

The frontend was built to demonstrate full-stack capability. The primary portfolio focus is the backend — this SPA shows ability to work across the stack with modern Angular patterns.

---

## License

MIT