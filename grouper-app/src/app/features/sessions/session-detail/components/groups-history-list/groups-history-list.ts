import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../../../../core/services/i18n.service';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';
import { GroupingResult } from '../../../../../models/group.model';
import { strategyLabelKey } from '../../strategy-label';

export interface GroupsHistoryEntry {
  index: number;
  result: GroupingResult;
}

@Component({
  selector: 'app-groups-history-list',
  templateUrl: './groups-history-list.html',
  styleUrl: './groups-history-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class GroupsHistoryList {
  private readonly i18n = inject(I18nService);

  readonly entries = input.required<GroupsHistoryEntry[]>();
  readonly selectedIndex = input<number | null>(null);
  readonly locale = input.required<string>();

  readonly selectEntry = output<number>();

  readonly visible = computed(() => this.entries().length >= 2);
  readonly currentIndex = computed(() => this.selectedIndex() ?? this.entries()[0]?.index ?? null);

  strategyKey(entry: GroupsHistoryEntry): string {
    return strategyLabelKey(entry.result.strategy);
  }

  formatDate(entry: GroupsHistoryEntry): string {
    return new Intl.DateTimeFormat(this.locale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(entry.result.timestamp);
  }

  entryLabel(entry: GroupsHistoryEntry): string {
    const satisfaction = entry.result.overallSatisfaction;
    const label = this.i18n.t('sessionDetail.history.entryLabel', {
      strategy: this.i18n.t(this.strategyKey(entry)),
      date: this.formatDate(entry),
      satisfaction:
        satisfaction === undefined ? '' : this.i18n.t('sessionDetail.satisfaction', { score: satisfaction }),
    });
    if (satisfaction !== undefined) {
      return label;
    }
    const trimmed = label.trimEnd();
    return trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
  }
}
