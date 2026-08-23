import { Injectable, signal } from '@angular/core';

export interface DialogConfig {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  readonly input?: 'none' | 'password' | 'text';
  readonly inputLabel?: string;
}

export interface DialogResult {
  readonly confirmed: boolean;
  readonly value?: string;
}

interface ActiveDialog extends DialogConfig {
  readonly id: number;
  resolve: (r: DialogResult) => void;
  value: string;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  private seq = 0;
  private readonly _active = signal<ActiveDialog | null>(null);
  readonly active = this._active.asReadonly();

  confirm(config: DialogConfig): Promise<DialogResult> {
    return new Promise<DialogResult>((resolve) => {
      const id = ++this.seq;
      this._active.set({
        ...config,
        id,
        resolve,
        value: '',
        confirmLabel: config.confirmLabel ?? 'Confirm',
        cancelLabel: config.cancelLabel ?? 'Cancel',
        input: config.input ?? 'none',
      });
    });
  }

  setValue(value: string): void {
    const cur = this._active();
    if (cur) {
      this._active.set({ ...cur, value });
    }
  }

  close(confirmed: boolean): void {
    const cur = this._active();
    if (!cur) {
      return;
    }
    cur.resolve({ confirmed, value: cur.value });
    this._active.set(null);
  }
}
