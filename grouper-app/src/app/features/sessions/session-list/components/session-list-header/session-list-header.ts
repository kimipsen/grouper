import { ChangeDetectionStrategy, Component, ElementRef, output, viewChild } from '@angular/core';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-session-list-header',
  templateUrl: './session-list-header.html',
  styleUrl: './session-list-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class SessionListHeader {
  readonly create = output<void>();
  readonly import = output<void>();

  private readonly newSessionButton = viewChild.required<ElementRef<HTMLButtonElement>>('newSessionButton');

  focusNewSession(): void {
    this.newSessionButton().nativeElement.focus();
  }
}
