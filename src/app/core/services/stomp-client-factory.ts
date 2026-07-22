import { Injectable } from '@angular/core';
import { Client, StompConfig } from '@stomp/stompjs';

/**
 * Thin injectable wrapper around `new Client(config)`.
 *
 * Exists purely as a testing seam. WebSocketService previously called
 * `new Client(...)` directly, which required tests to intercept the
 * constructor via `vi.mock('@stomp/stompjs', ...)`. That pattern proved
 * unreliable across three different environments — a local sandbox, a
 * real long-lived `ng test` watch session, and GitHub Actions CI — each
 * surfacing a different, hard-to-pin-down symptom (build-cache staleness,
 * suspected TestBed injector staleness, and an unexplained CI-only
 * failure not reproducible locally even under matching --watch=false and
 * single-fork conditions). Every fix attempt at the mocking layer reduced
 * but never eliminated the flakiness.
 *
 * Rather than continue chasing vi.mock()'s interaction with the bundler
 * across environments, WebSocketService now depends on this factory
 * through Angular's own DI — the same mechanism already used, with zero
 * observed flakiness across this entire investigation, to fake
 * AuthService/IncidentService/LoggerService/ToastService in
 * websocket.service.spec.ts. Production code gets the real
 * implementation via `providedIn: 'root'`; tests provide a trivial fake
 * via a TestBed provider — no module mocking involved anywhere.
 */
@Injectable({
  providedIn: 'root'
})
export class StompClientFactory {
  create(config: StompConfig): Client {
    return new Client(config);
  }
}