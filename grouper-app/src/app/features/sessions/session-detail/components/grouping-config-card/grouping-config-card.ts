import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, input, output, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { GenderMode, GroupingStrategy } from '../../../../../models/group.model';
import { CustomWeightDefinition } from '../../../../../models/session.model';
import { ValidationMessage } from '../../../../../core/services/grouping.service';

export interface GroupingFieldError extends ValidationMessage {
  fieldId: string;
}
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-grouping-config-card',
  templateUrl: './grouping-config-card.html',
  styleUrl: './grouping-config-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
})
export class GroupingConfigCard {
  readonly groupingStrategyControl = input.required<FormControl<GroupingStrategy>>();
  readonly groupSizeControl = input.required<FormControl<number>>();
  readonly allowPartialGroupsControl = input.required<FormControl<boolean>>();
  readonly genderModeControl = input.required<FormControl<GenderMode>>();
  readonly preferenceWantWithControl = input.required<FormControl<number>>();
  readonly preferenceAvoidControl = input.required<FormControl<number>>();
  readonly customWeights = input.required<CustomWeightDefinition[]>();
  readonly selectedWeightIds = input.required<string[]>();
  readonly genderWeightId = input.required<string>();
  readonly peopleCount = input.required<number>();
  readonly error = input<ValidationMessage | null>(null);
  readonly fieldErrors = input<GroupingFieldError[]>([]);

  readonly errorsByField = computed(() => new Map(this.fieldErrors().map((error) => [error.fieldId, error])));
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');

  readonly generateGroups = output<void>();
  readonly resetSession = output<void>();
  readonly toggleWeightSelection = output<string>();
  /** Emits the id of the field an error summary link points to; the field may be on another tab. */
  readonly focusField = output<string>();

  readonly GroupingStrategy = GroupingStrategy;

  readonly genderModeOptions: { value: GenderMode; labelKey: string }[] = [
    { value: 'mixed', labelKey: 'sessionDetail.genderMode.mixed' },
    { value: 'single', labelKey: 'sessionDetail.genderMode.single' },
    { value: 'ignore', labelKey: 'sessionDetail.genderMode.ignore' },
  ];

  readonly strategyOptions: { value: GroupingStrategy; labelKey: string }[] = [
    { value: GroupingStrategy.RANDOM, labelKey: 'sessionDetail.strategyRandom' },
    { value: GroupingStrategy.PREFERENCE_BASED, labelKey: 'sessionDetail.strategyPreferenceBased' },
    { value: GroupingStrategy.WEIGHTED, labelKey: 'sessionDetail.strategyWeighted' },
  ];

  constructor() {
    // Move focus to the error summary each time a new set of field errors is shown.
    afterRenderEffect(() => {
      if (this.fieldErrors().length) {
        this.errorSummary()?.nativeElement.focus();
      }
    });
  }

  followErrorLink(event: Event, fieldId: string): void {
    event.preventDefault();
    this.focusField.emit(fieldId);
  }
}
