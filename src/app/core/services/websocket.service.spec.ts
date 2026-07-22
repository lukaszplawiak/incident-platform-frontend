import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { WebSocketService } from './websocket.service';
import { AuthService } from './auth.service';
import { IncidentService } from './incident.service';
import { LoggerService } from './logger.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { StompClientFactory } from './stomp-client-factory';
import { IMessage } from '@stomp/stompjs';
import { Incident, IncidentWebSocketEvent } from '../models/incident.model';

// ─── Fake STOMP client ────────────────────────────────────────────────────────
//
// WebSocketService gets its STOMP Client through an injected
// StompClientFactory rather than calling `new Client(...)` directly (see
// stomp-client-factory.ts for why). That means faking it here is a plain
// TestBed provider — { provide: StompClientFactory, useValue: ... } — the
// exact same mechanism already used below for AuthService/IncidentService/
// LoggerService/ToastService, none of which have ever shown flakiness
// across this investigation. No vi.mock(), no module interception, no
// vi.hoisted() needed: mockActivate/mockDeactivate/mockSubscribe are
// ordinary `let` bindings reassigned fresh in beforeEach, just like every
// other mock in this file.
//
// Previously this mocked '@stomp/stompjs' via vi.mock() with a MockClient
// class assigned to `this.activate = mockActivate` etc. That approach
// produced three different, unreproducible flakiness symptoms across three
// environments (a local sandbox, a real watch-mode session, and GitHub
// Actions CI) despite several rounds of hardening (vi.hoisted(),
// vi.resetAllMocks(), explicit TestBed.resetTestingModule(), disabling the
// Angular CLI build cache). None of it eliminated it, because none of it
// addressed the actual point of fragility: intercepting a third-party
// module's constructor via the bundler/test-runner integration, in an
// environment (@angular/build:unit-test) too new and too under-documented
// to fully audit. Removing that dependency entirely is the fix.

// ─── Test data ────────────────────────────────────────────────────────────────

function buildIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'incident-1',
    title: 'High CPU',
    description: '',
    severity: 'CRITICAL',
    status: 'OPEN',
    tenantId: 'acme-corp',
    source: 'prometheus',
    sourceType: 'OPS',
    fingerprint: 'fp-1',
    alertId: 'alert-1',
    openedAt: '2026-01-01T00:00:00Z',
    acknowledgedAt: null,
    resolvedAt: null,
    closedAt: null,
    mttaSeconds: null,
    mttrSeconds: null,
    assignedTo: null,
    escalationLevel: 0,
    version: 1,
    ...overrides,
  };
}

function buildRawStompMessage(body: string): IMessage {
  return {
    body,
    ack: () => undefined,
    nack: () => undefined,
    command: 'MESSAGE',
    headers: {},
    isBinaryBody: false,
    binaryBody: new Uint8Array(),
  };
}

function buildStompMessage(event: IncidentWebSocketEvent): IMessage {
  return {
    body: JSON.stringify(event),
    ack: () => undefined,
    nack: () => undefined,
    command: 'MESSAGE',
    headers: {},
    isBinaryBody: false,
    binaryBody: new Uint8Array(),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('WebSocketService', () => {
  let service: WebSocketService;
  let mockAuthService: {
    getToken: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
    tenantId: ReturnType<typeof vi.fn>;
  };
  let mockIncidentService: {
    addIncident: ReturnType<typeof vi.fn>;
    updateIncident: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let mockToast: {
    info: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  let mockActivate: ReturnType<typeof vi.fn>;
  let mockDeactivate: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let mockStompClientFactory: { create: ReturnType<typeof vi.fn> };
  let capturedOnConnect: (() => void) | undefined;
  let capturedOnDisconnect: (() => void) | undefined;

  beforeEach(() => {
    capturedOnConnect = undefined;
    capturedOnDisconnect = undefined;
    mockActivate = vi.fn();
    mockDeactivate = vi.fn();
    mockUnsubscribe = vi.fn();
    mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: mockUnsubscribe });

    mockStompClientFactory = {
      create: vi.fn().mockImplementation(
        (config: { onConnect: () => void; onDisconnect: () => void }) => {
          capturedOnConnect = config.onConnect;
          capturedOnDisconnect = config.onDisconnect;
          return {
            activate: mockActivate,
            deactivate: mockDeactivate,
            subscribe: mockSubscribe,
          };
        }
      ),
    };

    mockAuthService = {
      getToken: vi.fn().mockReturnValue('valid-jwt-token'),
      isAuthenticated: vi.fn().mockReturnValue(true),
      tenantId: vi.fn().mockReturnValue('acme-corp'),
    };

    mockIncidentService = {
      addIncident: vi.fn(),
      updateIncident: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockToast = {
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        WebSocketService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: IncidentService, useValue: mockIncidentService },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ToastService, useValue: mockToast },
        { provide: StompClientFactory, useValue: mockStompClientFactory },
      ],
    });

    service = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Initial state
  // ──────────────────────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts in DISCONNECTED state', () => {
      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('isConnected returns false initially', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('isReconnecting returns false initially', () => {
      expect(service.isReconnecting()).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // connect()
  // ──────────────────────────────────────────────────────────────────────────

  describe('connect', () => {
    it('sets state to CONNECTING when called with valid token', () => {
      service.connect();

      expect(service.connectionState()).toBe('CONNECTING');
    });

    it('activates the STOMP client', () => {
      service.connect();

      expect(mockActivate).toHaveBeenCalledTimes(1);
    });

    it('does not connect when token is missing', () => {
      mockAuthService.getToken.mockReturnValue(null);

      service.connect();

      expect(service.connectionState()).toBe('DISCONNECTED');
      expect(mockActivate).not.toHaveBeenCalled();
    });

    it('does not connect again when already CONNECTED', () => {
      service.connect();
      capturedOnConnect?.();

      service.connect();

      expect(mockActivate).toHaveBeenCalledTimes(1);
    });

    it('does not connect again when already CONNECTING', () => {
      service.connect();
      service.connect();

      expect(mockActivate).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // onConnect callback
  // ──────────────────────────────────────────────────────────────────────────

  describe('after STOMP connection established', () => {
    beforeEach(() => {
      service.connect();
    });

    it('sets state to CONNECTED when onConnect fires', () => {
      capturedOnConnect?.();

      expect(service.connectionState()).toBe('CONNECTED');
    });

    it('isConnected returns true after connection', () => {
      capturedOnConnect?.();

      expect(service.isConnected()).toBe(true);
    });

    it('subscribes to /topic/incidents after connection', () => {
      capturedOnConnect?.();

      expect(mockSubscribe).toHaveBeenCalledWith(
        '/topic/incidents/acme-corp',
        expect.any(Function)
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // disconnect()
  // ──────────────────────────────────────────────────────────────────────────

  describe('disconnect', () => {
    it('sets state to DISCONNECTED', () => {
      service.connect();
      capturedOnConnect?.();
      expect(service.connectionState()).toBe('CONNECTED');

      service.disconnect();

      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('isConnected returns false after disconnect', () => {
      service.connect();
      capturedOnConnect?.();

      service.disconnect();

      expect(service.isConnected()).toBe(false);
    });

    it('deactivates the STOMP client', () => {
      service.connect();
      service.disconnect();

      expect(mockDeactivate).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleIncidentEvent — CREATED
  // ──────────────────────────────────────────────────────────────────────────

  describe('WebSocket event handling — CREATED', () => {
    let messageHandler: ((msg: IMessage) => void) | undefined;

    beforeEach(() => {
      // Explicit reset before re-wiring — messageHandler is plain test
      // state (not a vi.fn()), so vi.resetAllMocks() in the outer
      // beforeEach does not touch it. Without this, a stale handler from
      // a previous test could theoretically survive if service.connect()
      // ever failed to re-subscribe for any reason, silently calling into
      // a mismatched mockLogger/mockIncidentService instance instead of
      // the current test's.
      messageHandler = undefined;
      mockSubscribe.mockImplementation((_topic: string, handler: (msg: IMessage) => void) => {
        messageHandler = handler;
        return { unsubscribe: vi.fn() };
      });
      service.connect();
      capturedOnConnect?.();
    });

    it('calls incidentService.addIncident for CREATED event', () => {
      const incident = buildIncident({ id: 'new-1' });
      const event: IncidentWebSocketEvent = { eventType: 'CREATED', incident };

      messageHandler?.(buildStompMessage(event));

      expect(mockIncidentService.addIncident).toHaveBeenCalledWith(incident);
    });

    it('shows info toast for CREATED event', () => {
      const incident = buildIncident({ title: 'Database down' });
      const event: IncidentWebSocketEvent = { eventType: 'CREATED', incident };

      messageHandler?.(buildStompMessage(event));

      expect(mockToast.info).toHaveBeenCalledWith(
        expect.stringContaining('Database down')
      );
    });

    it('does not call updateIncident for CREATED event', () => {
      const incident = buildIncident();
      const event: IncidentWebSocketEvent = { eventType: 'CREATED', incident };

      messageHandler?.(buildStompMessage(event));

      expect(mockIncidentService.updateIncident).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleIncidentEvent — UPDATED / STATUS_CHANGED
  // ──────────────────────────────────────────────────────────────────────────

  describe('WebSocket event handling — UPDATED and STATUS_CHANGED', () => {
    let messageHandler: ((msg: IMessage) => void) | undefined;

    beforeEach(() => {
      // Explicit reset before re-wiring — messageHandler is plain test
      // state (not a vi.fn()), so vi.resetAllMocks() in the outer
      // beforeEach does not touch it. Without this, a stale handler from
      // a previous test could theoretically survive if service.connect()
      // ever failed to re-subscribe for any reason, silently calling into
      // a mismatched mockLogger/mockIncidentService instance instead of
      // the current test's.
      messageHandler = undefined;
      mockSubscribe.mockImplementation((_topic: string, handler: (msg: IMessage) => void) => {
        messageHandler = handler;
        return { unsubscribe: vi.fn() };
      });
      service.connect();
      capturedOnConnect?.();
    });

    it('calls incidentService.updateIncident for UPDATED event', () => {
      const incident = buildIncident({ status: 'ACKNOWLEDGED' });
      const event: IncidentWebSocketEvent = { eventType: 'UPDATED', incident };

      messageHandler?.(buildStompMessage(event));

      expect(mockIncidentService.updateIncident).toHaveBeenCalledWith(incident);
    });

    it('calls incidentService.updateIncident for STATUS_CHANGED event', () => {
      const incident = buildIncident({ status: 'RESOLVED' });
      const event: IncidentWebSocketEvent = { eventType: 'STATUS_CHANGED', incident };

      messageHandler?.(buildStompMessage(event));

      expect(mockIncidentService.updateIncident).toHaveBeenCalledWith(incident);
    });

    it('shows info toast for UPDATED event', () => {
      const incident = buildIncident({ title: 'High CPU', status: 'ACKNOWLEDGED' });
      const event: IncidentWebSocketEvent = { eventType: 'UPDATED', incident };

      messageHandler?.(buildStompMessage(event));

      expect(mockToast.info).toHaveBeenCalledWith(
        expect.stringContaining('High CPU')
      );
    });

    it('does not call addIncident for UPDATED event', () => {
      const incident = buildIncident();
      const event: IncidentWebSocketEvent = { eventType: 'UPDATED', incident };

      messageHandler?.(buildStompMessage(event));

      expect(mockIncidentService.addIncident).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket event handling — INCIDENT_UPDATED', () => {
    let messageHandler: ((msg: IMessage) => void) | undefined;

    beforeEach(() => {
      // Explicit reset before re-wiring — messageHandler is plain test
      // state (not a vi.fn()), so vi.resetAllMocks() in the outer
      // beforeEach does not touch it. Without this, a stale handler from
      // a previous test could theoretically survive if service.connect()
      // ever failed to re-subscribe for any reason, silently calling into
      // a mismatched mockLogger/mockIncidentService instance instead of
      // the current test's.
      messageHandler = undefined;
      mockSubscribe.mockImplementation((_topic: string, handler: (msg: IMessage) => void) => {
        messageHandler = handler;
        return { unsubscribe: vi.fn() };
      });
      service.connect();
      capturedOnConnect?.();
    });

    it('calls incidentService.updateIncident for INCIDENT_UPDATED event', () => {
      // INCIDENT_UPDATED is sent when a duplicate alert escalates an existing
      // incident's severity without changing its status — e.g.
      // IncidentWebSocketPublisher.publishUpdate() on the backend.
      const incident = buildIncident({ severity: 'CRITICAL' });
      const event: IncidentWebSocketEvent = { eventType: 'INCIDENT_UPDATED', incident };

      messageHandler?.(buildStompMessage(event));

      expect(mockIncidentService.updateIncident).toHaveBeenCalledWith(incident);
    });

    it('does not show a toast for INCIDENT_UPDATED event', () => {
      // Deliberate UX difference from INCIDENT_CREATED/STATUS_CHANGED — a
      // silent data refresh doesn't need operator attention the way a new
      // incident or a status transition does.
      const incident = buildIncident({ title: 'High CPU', severity: 'CRITICAL' });
      const event: IncidentWebSocketEvent = { eventType: 'INCIDENT_UPDATED', incident };

      messageHandler?.(buildStompMessage(event));

      expect(mockToast.info).not.toHaveBeenCalled();
    });

    it('does not call addIncident for INCIDENT_UPDATED event', () => {
      const incident = buildIncident();
      const event: IncidentWebSocketEvent = { eventType: 'INCIDENT_UPDATED', incident };

      messageHandler?.(buildStompMessage(event));

      expect(mockIncidentService.addIncident).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleIncidentEvent — invalid messages
  // ──────────────────────────────────────────────────────────────────────────

  describe('WebSocket event handling — invalid messages', () => {
    let messageHandler: ((msg: IMessage) => void) | undefined;

    beforeEach(() => {
      // Explicit reset before re-wiring — messageHandler is plain test
      // state (not a vi.fn()), so vi.resetAllMocks() in the outer
      // beforeEach does not touch it. Without this, a stale handler from
      // a previous test could theoretically survive if service.connect()
      // ever failed to re-subscribe for any reason, silently calling into
      // a mismatched mockLogger/mockIncidentService instance instead of
      // the current test's.
      messageHandler = undefined;
      mockSubscribe.mockImplementation((_topic: string, handler: (msg: IMessage) => void) => {
        messageHandler = handler;
        return { unsubscribe: vi.fn() };
      });
      service.connect();
      capturedOnConnect?.();
    });

    it('does not throw when message body is invalid JSON', () => {
      expect(() => {
        messageHandler?.(buildStompMessage({ eventType: 'CREATED', incident: buildIncident() }));
      }).not.toThrow();
    });

    it('does not call addIncident or updateIncident for invalid JSON', () => {
      messageHandler?.(buildRawStompMessage('{broken json'));

      expect(mockIncidentService.addIncident).not.toHaveBeenCalled();
      expect(mockIncidentService.updateIncident).not.toHaveBeenCalled();
    });

    it('logs a warning for invalid JSON message', () => {
      messageHandler?.(buildRawStompMessage('invalid'));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('parse error')
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // reconnect — exponential backoff
  // ──────────────────────────────────────────────────────────────────────────

  describe('reconnect on disconnect', () => {
    it('sets state to RECONNECTING when connection drops unexpectedly', () => {
      vi.useFakeTimers();
      service.connect();
      capturedOnConnect?.();
      expect(service.connectionState()).toBe('CONNECTED');

      capturedOnDisconnect?.();

      expect(service.isReconnecting()).toBe(true);
    });

    it('aborts reconnect when token is expired', () => {
      vi.useFakeTimers();
      mockAuthService.getToken.mockReturnValue(null);
      mockAuthService.isAuthenticated.mockReturnValue(false);

      service.connect();
      capturedOnConnect?.();
      capturedOnDisconnect?.();

      vi.advanceTimersByTime(1500);

      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('does not reconnect after explicit disconnect()', () => {
      vi.useFakeTimers();
      service.connect();
      capturedOnConnect?.();

      service.disconnect();

      capturedOnDisconnect?.();

      vi.advanceTimersByTime(2000);

      expect(mockActivate).toHaveBeenCalledTimes(1);
    });
  });
});