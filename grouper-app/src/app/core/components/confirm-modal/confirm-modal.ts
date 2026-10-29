import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  inject,
  viewChild,
} from '@angular/core';
import { Modal } from 'dkfds';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * The app's single DKFDS confirmation modal, driven by ConfirmDialogService.
 * DKFDS makes every other child of <body> inert while a modal is open, so the
 * container is moved to be a direct child of <body>.
 */
@Component({
  selector: 'app-confirm-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div #container class="fds-modal-container">
      <div
        #modal
        id="confirm-modal"
        class="fds-modal"
        aria-hidden="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title">
        <!-- .modal-content must always exist: DKFDS hide() touches it after the content is gone. -->
        <div class="modal-content">
          @if (dialog.request(); as request) {
            <div class="modal-header">
              <h2 id="confirm-modal-title" class="modal-title">{{ request.titleKey | t:request.params }}</h2>
              <button class="modal-close function-link" type="button" (click)="dialog.settle(false)">
                <svg class="icon-svg" focusable="false" aria-hidden="true">
                  <use href="assets/dkfds/dist/img/all-svg-icons.svg#close"></use>
                </svg>{{ 'common.close' | t }}
              </button>
            </div>
            <div class="modal-body">
              <p>{{ request.messageKey | t:request.params }}</p>
            </div>
            <div class="modal-footer">
              <div class="button-group">
                <button class="button button-warning" type="button" (click)="dialog.settle(true)">
                  {{ request.confirmKey | t:request.params }}
                </button>
                <button class="button button-secondary" type="button" (click)="dialog.settle(false)">
                  {{ 'common.cancel' | t }}
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ConfirmModal {
  readonly dialog = inject(ConfirmDialogService);
  private readonly document = inject(DOCUMENT);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly modalElement = viewChild.required<ElementRef<HTMLElement>>('modal');

  private modal: Modal | null = null;
  private opener: HTMLElement | null = null;

  // DKFDS fires this for every close: our buttons, Escape and backdrop clicks.
  // It fires before DKFDS removes `inert` from the page, and inert elements can't take focus,
  // so focus is restored once hide() has finished.
  private readonly onHidden = () => {
    this.dialog.settle(false);
    queueMicrotask(() => this.restoreFocus());
  };

  constructor() {
    afterNextRender(() => {
      const modalElement = this.modalElement().nativeElement;
      this.document.body.appendChild(this.container().nativeElement);
      modalElement.addEventListener('fds.modal.hidden', this.onHidden);
      this.modal = new Modal(modalElement);
    });

    inject(DestroyRef).onDestroy(() => {
      this.modalElement().nativeElement.removeEventListener('fds.modal.hidden', this.onHidden);
      this.dialog.settle(false);
      this.container().nativeElement.remove();
    });

    // Runs after the @if content has rendered, so DKFDS can move focus into it.
    afterRenderEffect(() => {
      if (this.dialog.request()) {
        this.open();
      } else {
        this.close();
      }
    });
  }

  private open(): void {
    if (!this.modal || this.isVisible()) {
      return;
    }
    const active = this.document.activeElement;
    this.opener = active instanceof HTMLElement && active !== this.document.body ? active : null;
    this.modal.show();
  }

  private close(): void {
    if (this.modal && this.isVisible()) {
      this.modal.hide();
    }
  }

  private isVisible(): boolean {
    return this.modalElement().nativeElement.getAttribute('aria-hidden') === 'false';
  }

  /** Returns focus to the opener, or to the main landmark if the opener was removed (e.g. a deleted row). */
  private restoreFocus(): void {
    if (!this.opener) {
      return;
    }
    const target = this.opener.isConnected ? this.opener : this.document.getElementById('main-content');
    this.opener = null;
    target?.focus();
  }
}
