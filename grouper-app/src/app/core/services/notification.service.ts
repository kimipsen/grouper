import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: number;
  variant: ToastVariant;
  key: string;
  params?: Record<string, string | number>;
}

/**
 * Transient DKFDS toast messages (newest first). Repeating a visible message replaces it instead of stacking.
 * Success/info toasts dismiss themselves; the timer pauses while the toast is hovered or focused.
 * Warning/error toasts stay until closed.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  static readonly MAX_TOASTS = 3;
  static readonly AUTO_DISMISS_MS = 10_000;

  private readonly toastsSignal = signal<Toast[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 1;

  readonly toasts = this.toastsSignal.asReadonly();

  success(key: string, params?: Record<string, string | number>): void {
    this.show('success', key, params);
  }

  info(key: string, params?: Record<string, string | number>): void {
    this.show('info', key, params);
  }

  show(variant: ToastVariant, key: string, params?: Record<string, string | number>): void {
    const toast: Toast = { id: this.nextId++, variant, key, params };
    const duplicate = this.toastsSignal().find((existing) => this.isSameMessage(existing, toast));
    if (duplicate) {
      this.dismiss(duplicate.id);
    }

    const visible = [toast, ...this.toastsSignal()];

    for (const dropped of visible.slice(NotificationService.MAX_TOASTS)) {
      this.clearTimer(dropped.id);
    }

    this.toastsSignal.set(visible.slice(0, NotificationService.MAX_TOASTS));
    this.startTimer(toast);
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.toastsSignal.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  pause(id: number): void {
    this.clearTimer(id);
  }

  resume(id: number): void {
    const toast = this.toastsSignal().find((candidate) => candidate.id === id);
    if (toast) {
      this.startTimer(toast);
    }
  }

  private startTimer(toast: Toast): void {
    if (toast.variant !== 'success' && toast.variant !== 'info') {
      return;
    }

    this.clearTimer(toast.id);
    this.timers.set(
      toast.id,
      setTimeout(() => this.dismiss(toast.id), NotificationService.AUTO_DISMISS_MS),
    );
  }

  private isSameMessage(a: Toast, b: Toast): boolean {
    return a.variant === b.variant && a.key === b.key && JSON.stringify(a.params) === JSON.stringify(b.params);
  }

  private clearTimer(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }
}
