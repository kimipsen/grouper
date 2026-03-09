import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-session-list-empty-state',
  templateUrl: './session-list-empty-state.html',
  styleUrl: './session-list-empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class SessionListEmptyState {
  readonly create = output<void>();
}
