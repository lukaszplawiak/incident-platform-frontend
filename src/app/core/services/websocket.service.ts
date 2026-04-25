import { Injectable, inject, signal, OnDestroy, DestroyRef } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { IncidentService } from './incident.service';
import { IncidentWebSocketEvent } from '../models/incident.model';

export type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {

  private readonly authService = inject(AuthService);
  private readonly incidentService = inject(IncidentService);
  private readonly destroyRef = inject(DestroyRef);

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
    if (!token) return;

    this._connectionState.set('CONNECTING');
    this.createAndActivateClient(token);
  }

  disconnect(): void {
    this.cleanup();
    this._connectionState.set('DISCONNECTED');
    this.reconnectAttempts = 0;
  }

  ngOnDestroy(): void {
    this.disconnect();
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
        this.subscribeToIncidents();
      },

      onDisconnect: () => {
        this.subscription = null;
        if (this._connectionState() !== 'DISCONNECTED') {
          this.scheduleReconnect();
        }
      },

      onStompError: () => {
        // STOMP error — auto-reconnect handled by onDisconnect
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

    timer(delay).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      const freshToken = this.authService.getToken();

      if (!freshToken || !this.authService.isAuthenticated()) {
        this.disconnect();
        return;
      }

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
  }

  private handleIncidentEvent(message: IMessage): void {
    try {
      const event = JSON.parse(message.body) as IncidentWebSocketEvent;

      switch (event.eventType) {
        case 'CREATED':
          this.incidentService.addIncident(event.incident);
          break;
        case 'UPDATED':
        case 'STATUS_CHANGED':
          this.incidentService.updateIncident(event.incident);
          break;
      }
    } catch {
      // Invalid message format — ignore silently
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