import { Component, inject } from '@angular/core';
import { ToastService, ToastMessage, ToastType } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.html',
  styleUrl: './toast.scss'
})
export class Toast {

  readonly toastService = inject(ToastService);
  readonly toasts = this.toastService.toasts;

  getIcon(type: ToastType): string {
    const icons: Record<ToastType, string> = {
      'success': '✅',
      'error':   '❌',
      'warning': '⚠️',
      'info':    'ℹ️'
    };
    return icons[type];
  }

  getCssClass(type: ToastType): string {
    return `toast-item toast-item--${type}`;
  }

  onDismiss(toast: ToastMessage): void {
    this.toastService.dismiss(toast.id);
  }
}