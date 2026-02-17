import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Session } from '../../../../../models/session.model';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-session-list-card',
  templateUrl: './session-list-card.html',
  styleUrl: './session-list-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, TranslatePipe],
})
export class SessionListCard {
  readonly session = input.required<Session>();
  readonly currentDateLocale = input.required<string>();

  readonly open = output<void>();
  readonly remove = output<void>();
  readonly export = output<void>();

  onDelete(event: Event): void {
    event.stopPropagation();
    this.remove.emit();
  }

  onExport(event: Event): void {
    event.stopPropagation();
    this.export.emit();
  }
}
