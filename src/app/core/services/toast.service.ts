import { Injectable, signal, computed } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly message: string;
  readonly actionLabel?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  private seq = 0;
  readonly toasts = this._toasts.asReadonly();

  show(
    message: string,
    kind: ToastKind = 'info',
    actionLabel?: string,
  ): number {
    const id = ++this.seq;
    this._toasts.update((t) => [...t, { id, kind, message, actionLabel }]);
    if (kind !== 'error') {
      setTimeout(() => this.dismiss(id), 4000);
    }
    return id;
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  warning(message: string): void {
    this.show(message, 'warning');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  dismiss(id: number): void {
    this._toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
