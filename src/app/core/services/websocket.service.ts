import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { IncidentService } from './incident.service';
import { LoggerService } from './logger.service';
import { IncidentWebSocketEvent } from '../models/incident.model';
import { ToastService } from '../../shared/components/toast/toast.service';

export type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {

  private readonly authService = inject(AuthService);
  private readonly incidentService = inject(IncidentService);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toastService = inject(ToastService);

  private readonly _connectionState = signal<ConnectionState>('DISCONNECTED');
  readonly connectionState = this._connectionState.asReadonly();
  readonly isConnected = () => this._connectionState() === 'CONNECTED';
  readonly isReconnecting = () => this._connectionState() === 'RECONNECTING';

  private stompClient: Client | null = null;
  private subscription: StompSubscription | null = null;

  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_DELAY = 30_000;
  private readonly BASE_RECONNECT_DELAY = 1_000;

  connect(): void {
    if (this._connectionState() === 'CONNECTED' ||
        this._connectionState() === 'CONNECTING') {
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      this.logger.warn('WebSocket connect called without valid token');
      return;
    }

    this.logger.info('WebSocket connecting', { url: environment.wsUrl });
    this._connectionState.set('CONNECTING');
    this.createAndActivateClient(token);
  }

  disconnect(): void {
    this.logger.info('WebSocket disconnecting');
    this.cleanup();
    this._connectionState.set('DISCONNECTED');
    this.reconnectAttempts = 0;
  }

  private createAndActivateClient(token: string): void {
    this.stompClient = new Client({
      brokerURL: environment.wsUrl,
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      reconnectDelay: 0,

      onConnect: () => {
        this._connectionState.set('CONNECTED');
        this.reconnectAttempts = 0;
        this.logger.info('WebSocket connected');
        this.subscribeToIncidents();
      },

      onDisconnect: () => {
        this.subscription = null;
        this.logger.warn('WebSocket disconnected', {
          attempts: this.reconnectAttempts
        });
        if (this._connectionState() !== 'DISCONNECTED') {
          this.scheduleReconnect();
        }
      },

      onStompError: () => {
        this.logger.warn('WebSocket STOMP error occurred');
      }
    });

    this.stompClient.activate();

    this.destroyRef.onDestroy(() => this.cleanup());
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      this.BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      this.MAX_RECONNECT_DELAY
    );
    this.reconnectAttempts++;
    this._connectionState.set('RECONNECTING');

    this.logger.info('WebSocket scheduling reconnect', {
      attempt: this.reconnectAttempts,
      delayMs: delay
    });

    timer(delay).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      const freshToken = this.authService.getToken();

      if (!freshToken || !this.authService.isAuthenticated()) {
        this.logger.warn('WebSocket reconnect aborted — token expired');
        this.disconnect();
        return;
      }

      this.logger.info('WebSocket reconnecting with fresh token');
      this.cleanup();
      this._connectionState.set('CONNECTING');
      this.createAndActivateClient(freshToken);
    });
  }

  private subscribeToIncidents(): void {
    if (!this.stompClient) return;

    this.subscription = this.stompClient.subscribe(
      '/topic/incidents',
      (message: IMessage) => this.handleIncidentEvent(message)
    );

    this.logger.debug('WebSocket subscribed to /topic/incidents');
  }

  private handleIncidentEvent(message: IMessage): void {
    try {
      const event = JSON.parse(message.body) as IncidentWebSocketEvent;

      this.logger.debug('WebSocket event received', {
        eventType: event.eventType,
        incidentId: event.incident.id
      });

      switch (event.eventType) {
        case 'CREATED':
          this.incidentService.addIncident(event.incident);
          this.toastService.info(`🔴 New incident: ${event.incident.title}`);
          break;
        case 'UPDATED':
        case 'STATUS_CHANGED':
          this.incidentService.updateIncident(event.incident);
          this.toastService.info(`Status changed: ${event.incident.title} → ${event.incident.status}`);
          break;
      }
    } catch {
      this.logger.warn('WebSocket received invalid message — parse error');
    }
  }

  private cleanup(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
  }
}