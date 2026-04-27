import { Injectable, inject, OnDestroy } from '@angular/core';
import { fromEvent, merge, Subscription, throttleTime } from 'rxjs';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class IdleService implements OnDestroy {

  private readonly authService = inject(AuthService);
  private readonly logger = inject(LoggerService);

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private activitySubscription: Subscription | null = null;

  private readonly IDLE_TIMEOUT_MS = environment.autoLogoutMinutes * 60 * 1000;

  startWatching(): void {
    if (this.activitySubscription) return;

    this.logger.debug('IdleService: started watching user activity');

    const activity$ = merge(
      fromEvent(document, 'mousemove'),
      fromEvent(document, 'keydown'),
      fromEvent(document, 'click'),
      fromEvent(document, 'touchstart'),
      fromEvent(document, 'scroll')
    ).pipe(
      throttleTime(1_000)
    );

    this.activitySubscription = activity$.subscribe(() => {
      this.resetTimer();
    });

    this.resetTimer();
  }
  stopWatching(): void {
    this.clearTimer();

    if (this.activitySubscription) {
      this.activitySubscription.unsubscribe();
      this.activitySubscription = null;
    }

    this.logger.debug('IdleService: stopped watching user activity');
  }

  ngOnDestroy(): void {
    this.stopWatching();
  }

  private resetTimer(): void {
    this.clearTimer();

    this.idleTimer = setTimeout(() => {
      if (this.authService.isAuthenticated()) {
        this.logger.warn('IdleService: user idle timeout — logging out', {
          idleTimeoutMinutes: environment.autoLogoutMinutes
        });
        this.authService.logout();
      }
    }, this.IDLE_TIMEOUT_MS);
  }

  private clearTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}