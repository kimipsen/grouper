import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  titleKey: string;
  messageKey: string;
  confirmKey: string;
  params?: Record<string, string | number>;
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/** Opens the shared DKFDS confirmation modal and resolves with the user's choice. */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly requestSignal = signal<ConfirmRequest | null>(null);

  readonly request = this.requestSignal.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    // DKFDS allows one modal at a time; a new request cancels the previous one.
    this.settle(false);
    return new Promise((resolve) => this.requestSignal.set({ ...options, resolve }));
  }

  settle(confirmed: boolean): void {
    const request = this.requestSignal();
    if (!request) {
      return;
    }

    this.requestSignal.set(null);
    request.resolve(confirmed);
  }
}
