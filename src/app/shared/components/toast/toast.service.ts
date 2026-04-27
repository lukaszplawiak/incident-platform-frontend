import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  private readonly _toasts = signal<ToastMessage[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(message: string, duration = 4000): void {
    this.show({ type: 'success', message, duration });
  }

  error(message: string, duration = 6000): void {
    this.show({ type: 'error', message, duration });
  }

  warning(message: string, duration = 5000): void {
    this.show({ type: 'warning', message, duration });
  }

  info(message: string, duration = 4000): void {
    this.show({ type: 'info', message, duration });
  }

  dismiss(id: string): void {
    this._toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  private show(options: Omit<ToastMessage, 'id'>): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: ToastMessage = { id, ...options };

    this._toasts.update(toasts => [...toasts, toast]);

    setTimeout(() => this.dismiss(id), toast.duration);
  }
}