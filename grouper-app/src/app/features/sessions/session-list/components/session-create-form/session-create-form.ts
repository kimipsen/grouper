import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-session-create-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  template: `
    <form class="session-create-form" novalidate [formGroup]="form" (ngSubmit)="submit()">
      <h2 class="h3">{{ 'sessionList.createForm.title' | t }}</h2>
      <div class="form-group" [class.form-error]="showError()">
        <label class="form-label" for="new-session-name">{{ 'sessionList.createForm.nameLabel' | t }}</label>
        @if (showError()) {
          <span id="new-session-name-error" class="form-error-message">
            <span class="sr-only">{{ 'notifications.error' | t }} </span>{{ 'sessionList.createForm.nameRequired' | t }}
          </span>
        }
        <input
          #nameInput
          id="new-session-name"
          class="form-input"
          type="text"
          autocomplete="off"
          formControlName="name"
          [attr.aria-invalid]="showError() ? 'true' : null"
          [attr.aria-describedby]="showError() ? 'new-session-name-error' : null" />
      </div>
      <div class="button-group mt-5">
        <button class="button button-primary" type="submit">{{ 'sessionList.createForm.submit' | t }}</button>
        <button class="button button-secondary" type="button" (click)="cancelled.emit()">{{ 'common.cancel' | t }}</button>
      </div>
    </form>
  `,
  styles: `
    .session-create-form {
      margin-bottom: 2rem;
    }
  `,
})
export class SessionCreateForm {
  readonly created = output<string>();
  readonly cancelled = output<void>();

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] }),
  });
  readonly showError = signal(false);
  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  constructor() {
    afterNextRender(() => this.nameInput().nativeElement.focus());
  }

  submit(): void {
    const name = this.form.controls.name;
    if (name.invalid) {
      this.showError.set(true);
      this.nameInput().nativeElement.focus();
      return;
    }

    this.showError.set(false);
    this.created.emit(name.value.trim());
  }
}
