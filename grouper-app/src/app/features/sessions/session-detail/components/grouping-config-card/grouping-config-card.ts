import { ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, afterRenderEffect, computed, inject, input, output, viewChild } from '@angular/core';
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
  private readonly document = inject(DOCUMENT);

  readonly generateGroups = output<void>();
  readonly resetSession = output<void>();
  readonly toggleWeightSelection = output<string>();

  readonly GroupingStrategy = GroupingStrategy;

  constructor() {
    // Move focus to the error summary each time a new set of field errors is shown.
    afterRenderEffect(() => {
      if (this.fieldErrors().length) {
        this.errorSummary()?.nativeElement.focus();
      }
    });
  }

  focusField(event: Event, fieldId: string): void {
    event.preventDefault();
    this.document.getElementById(fieldId)?.focus();
  }
}
