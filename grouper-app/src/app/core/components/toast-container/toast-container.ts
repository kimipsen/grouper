import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** DKFDS toast container; render it as the first element inside main#main-content. */
@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="toast-container" aria-live="assertive" aria-atomic="false" aria-relevant="additions">
      @for (toast of notifications.toasts(); track toast.id) {
        <div
          [class]="'toast show toast-' + toast.variant"
          (mouseenter)="notifications.pause(toast.id)"
          (mouseleave)="notifications.resume(toast.id)"
          (focusin)="notifications.pause(toast.id)"
          (focusout)="notifications.resume(toast.id)">
          <div class="toast-icon"></div>
          <div class="toast-message">
            <p>
              <span class="sr-only">{{ 'notifications.' + toast.variant | t }}</span>
              <strong [id]="'toast-heading-' + toast.id">{{ toast.key | t:toast.params }}</strong>
            </p>
            <button
              class="toast-close"
              type="button"
              [attr.aria-describedby]="'toast-heading-' + toast.id"
              (click)="notifications.dismiss(toast.id)">
              {{ 'common.close' | t }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  readonly notifications = inject(NotificationService);
}
