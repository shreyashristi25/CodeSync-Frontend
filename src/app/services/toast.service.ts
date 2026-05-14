import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
  createdAt: number;
  ttlMs: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts$ = new BehaviorSubject<ToastItem[]>([]);

  push(type: ToastType, message: string, title?: string, ttlMs = 2800): void {
    const next: ToastItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      type,
      message,
      title,
      createdAt: Date.now(),
      ttlMs
    };

    this.toasts$.next([next, ...this.toasts$.value].slice(0, 6));
    setTimeout(() => this.dismiss(next.id), ttlMs);
  }

  success(message: string, title = 'SUCCESS'): void {
    this.push('success', message, title);
  }

  error(message: string, title = 'ERROR'): void {
    this.push('error', message, title, 3600);
  }

  warning(message: string, title = 'WARNING'): void {
    this.push('warning', message, title, 3400);
  }

  info(message: string, title = 'INFO'): void {
    this.push('info', message, title);
  }

  dismiss(id: number): void {
    this.toasts$.next(this.toasts$.value.filter((toast) => toast.id !== id));
  }
}
