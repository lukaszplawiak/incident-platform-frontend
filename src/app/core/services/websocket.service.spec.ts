import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { WebSocketService } from './websocket.service';
import { AuthService } from './auth.service';
import { IncidentService } from './incident.service';
import { LoggerService } from './logger.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { IMessage } from '@stomp/stompjs';
import { Incident, IncidentWebSocketEvent } from '../models/incident.model';

// ─── Mock STOMP Client ────────────────────────────────────────────────────────
//
// @stomp/stompjs uses `new Client(config)` — the mock must be a class or
// a regular function (not an arrow function) so it can work as a constructor.
//
// Approach: we mock the module with a MockClient class that:
// 1. Captures callbacks (onConnect, onDisconnect) from the config
// 2. Exposes methods (activate, deactivate, subscribe) as vi.fn()
// 3. Allows us to manually trigger callbacks in tests
//
// Uses vi.hoisted() — the documented, guaranteed-safe way to share values
// between a vi.mock() factory and the test body, since vi.mock() calls are
// hoisted above all other module code. This was tried as a fix for
// intermittent all-or-nothing failures of every test depending on these
// mocks (~30-50% of runs, identical 17 failures every time) — it did NOT
// fix it; the failures persisted with byte-identical symptoms. The actual
// root cause was `.angular/cache`: the experimental @angular/build:unit-test
// builder's persistent build cache was intermittently serving a stale
// bundle of this spec file. Disabling it (cli.cache.enabled: false in
// angular.json) made the flakiness disappear across 12/12 consecutive runs
// after 0/12 clean runs beforehand. Kept vi.hoisted() anyway since it's
// still the more correct pattern than ordinary outer `let` bindings, even
// though it wasn't the fix for this particular bug.
const hoisted = vi.hoisted(() => ({
  mockActivate: vi.fn(),
  mockDeactivate: vi.fn(),
  mockSubscribe: vi.fn(),
  mockUnsubscribe: vi.fn(),
  callbacks: {
    onConnect: undefined as (() => void) | undefined,
    onDisconnect: undefined as (() => void) | undefined,
  },
}));

const { mockActivate, mockDeactivate, mockSubscribe, mockUnsubscribe, callbacks } = hoisted;

// Typed interfaces for the STOMP mock — no `any` needed.
interface MockStompConfig {
  onConnect: () => void;
  onDisconnect: () => void;
  onStompError?: () => void;
}

interface MockStompClient {
  activate: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

vi.mock('@stomp/stompjs', () => {
  return {
    Client: function MockClient(this: MockStompClient, config: MockStompConfig) {
      hoisted.callbacks.onConnect = config.onConnect;
      hoisted.callbacks.onDisconnect = config.onDisconnect;
      this.activate = hoisted.mockActivate;
      this.deactivate = hoisted.mockDeactivate;
      this.subscribe = hoisted.mockSubscribe;
    },
  };
});

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

  beforeEach(() => {
    callbacks.onConnect = undefined;
    callbacks.onDisconnect = undefined;
    mockActivate.mockClear();
    mockDeactivate.mockClear();
    mockUnsubscribe.mockClear();
    mockSubscribe.mockClear();
    mockSubscribe.mockReturnValue({ unsubscribe: mockUnsubscribe });

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
      callbacks.onConnect?.();

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
      callbacks.onConnect?.();

      expect(service.connectionState()).toBe('CONNECTED');
    });

    it('isConnected returns true after connection', () => {
      callbacks.onConnect?.();

      expect(service.isConnected()).toBe(true);
    });

    it('subscribes to /topic/incidents after connection', () => {
      callbacks.onConnect?.();

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
      callbacks.onConnect?.();
      expect(service.connectionState()).toBe('CONNECTED');

      service.disconnect();

      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('isConnected returns false after disconnect', () => {
      service.connect();
      callbacks.onConnect?.();

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
      mockSubscribe.mockImplementation((_topic: string, handler: (msg: IMessage) => void) => {
        messageHandler = handler;
        return { unsubscribe: vi.fn() };
      });
      service.connect();
      callbacks.onConnect?.();
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
      mockSubscribe.mockImplementation((_topic: string, handler: (msg: IMessage) => void) => {
        messageHandler = handler;
        return { unsubscribe: vi.fn() };
      });
      service.connect();
      callbacks.onConnect?.();
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
      mockSubscribe.mockImplementation((_topic: string, handler: (msg: IMessage) => void) => {
        messageHandler = handler;
        return { unsubscribe: vi.fn() };
      });
      service.connect();
      callbacks.onConnect?.();
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
      mockSubscribe.mockImplementation = vi.fn().mockImplementation((_topic: string, handler: (msg: IMessage) => void) => {
        messageHandler = handler;
        return { unsubscribe: vi.fn() };
      });
      service.connect();
      callbacks.onConnect?.();
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
      callbacks.onConnect?.();
      expect(service.connectionState()).toBe('CONNECTED');

      callbacks.onDisconnect?.();

      expect(service.isReconnecting()).toBe(true);
    });

    it('aborts reconnect when token is expired', () => {
      vi.useFakeTimers();
      mockAuthService.getToken.mockReturnValue(null);
      mockAuthService.isAuthenticated.mockReturnValue(false);

      service.connect();
      callbacks.onConnect?.();
      callbacks.onDisconnect?.();

      vi.advanceTimersByTime(1500);

      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('does not reconnect after explicit disconnect()', () => {
      vi.useFakeTimers();
      service.connect();
      callbacks.onConnect?.();

      service.disconnect();

      callbacks.onDisconnect?.();

      vi.advanceTimersByTime(2000);

      expect(mockActivate).toHaveBeenCalledTimes(1);
    });
  });
});