import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  computed,
  signal,
  effect,
  DestroyRef
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { DatePipe } from '@angular/common';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IncidentService } from '../../../core/services/incident.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/services/auth.service';
import { IdleService } from '../../../core/services/idle.service';
import { LoggerService } from '../../../core/services/logger.service';
import { IncidentList } from '../incident-list/incident-list';
import { IncidentFilter } from '../incident-filter/incident-filter';
import { IncidentPagination } from '../incident-pagination/incident-pagination';
import {
  IncidentFilter as IncidentFilterModel,
  UpdateStatusRequest,
  SortColumn
} from '../../../core/models/incident.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IncidentList, IncidentFilter, IncidentPagination, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit, OnDestroy {

  private readonly incidentService = inject(IncidentService);
  private readonly wsService = inject(WebSocketService);
  private readonly titleService = inject(Title);
  readonly authService = inject(AuthService);
  private readonly idleService = inject(IdleService);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly AUTO_REFRESH_INTERVAL_MS = 30_000;

  readonly incidents = this.incidentService.incidents;
  readonly loading = this.incidentService.loading;
  readonly error = this.incidentService.error;
  readonly totalElements = this.incidentService.totalElements;
  readonly totalPages = this.incidentService.totalPages;
  readonly currentPage = this.incidentService.currentPage;
  readonly criticalCount = this.incidentService.criticalCount;
  readonly openCount = this.incidentService.openCount;
  readonly wsState = this.wsService.connectionState;
  readonly sortState = this.incidentService.sortState;
  readonly lastRefreshedAt = signal<Date | null>(null);

  readonly sessionExpiryDisplay = computed(() => {
    const ms = this.authService.sessionRemainingMs();
    if (ms === null) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  });

  readonly showExpiryWarning = computed(() =>
    this.authService.sessionIsExpiringSoon()
  );

  readonly pageTitle = computed(() => {
    const open = this.openCount();
    return open > 0 ? `(${open}) Incident Platform` : 'Incident Platform';
  });

  readonly isAutoRefreshActive = computed(() =>
    this.wsState() !== 'CONNECTED'
  );

  private currentFilter: IncidentFilterModel = {};

  constructor() {
    effect(() => {
      this.titleService.setTitle(this.pageTitle());
    });
  }

  ngOnInit(): void {
    this.logger.info('Dashboard initialized');
    this.incidentService.loadIncidents();
    this.lastRefreshedAt.set(new Date());
    this.wsService.connect();
    this.startAutoRefresh();
    this.idleService.startWatching();
  }

  ngOnDestroy(): void {
    this.wsService.disconnect();
    this.idleService.stopWatching();
    this.logger.info('Dashboard destroyed');
  }

  private startAutoRefresh(): void {
    interval(this.AUTO_REFRESH_INTERVAL_MS).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (this.wsState() !== 'CONNECTED') {
        this.logger.info('Auto-refresh triggered — WebSocket offline');
        this.incidentService.loadIncidents(this.currentFilter);
        this.lastRefreshedAt.set(new Date());
      } else {
        this.logger.debug('Auto-refresh skipped — WebSocket connected');
      }
    });
  }

  onExtendSession(): void {
    this.authService.resetAutoLogoutTimer();
    this.logger.info('Session extended — auto-logout timer reset');
  }

  onFilterChange(filter: IncidentFilterModel): void {
    this.currentFilter = filter;
    this.logger.debug('Filter changed', { filter });
    this.incidentService.loadIncidents(filter);
    this.lastRefreshedAt.set(new Date());
  }

  onPageChange(page: number): void {
    this.logger.debug('Page changed', { page });
    this.incidentService.loadIncidents({ ...this.currentFilter, page });
  }

  onSort(column: SortColumn): void {
    this.logger.debug('Sort changed', { column });
    this.incidentService.sortIncidents(column);
  }

  onAcknowledge(incidentId: string): void {
    const request: UpdateStatusRequest = { status: 'ACKNOWLEDGED' };
    this.incidentService.updateStatus(incidentId, request);
  }

  onResolve(incidentId: string): void {
    const request: UpdateStatusRequest = { status: 'RESOLVED' };
    this.incidentService.updateStatus(incidentId, request);
  }

  onRefresh(): void {
    this.logger.debug('Manual refresh triggered');
    this.incidentService.loadIncidents(this.currentFilter);
    this.lastRefreshedAt.set(new Date());
  }

  onLogout(): void {
    this.wsService.disconnect();
    this.idleService.stopWatching();
    this.authService.logout();
  }

  onDismissError(): void {
    this.incidentService.clearError();
  }
}