import { ChangeDetectionStrategy, Component, output } from '@angular/core';
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
}
