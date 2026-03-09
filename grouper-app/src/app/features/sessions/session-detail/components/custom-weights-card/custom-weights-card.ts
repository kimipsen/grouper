import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { WeightedGroupingMode } from '../../../../../models/group.model';
import { CustomWeightDefinition } from '../../../../../models/session.model';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-custom-weights-card',
  templateUrl: './custom-weights-card.html',
  styleUrl: './custom-weights-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
})
export class CustomWeightsCard {
  readonly customWeights = input.required<CustomWeightDefinition[]>();
  readonly newWeightNameControl = input.required<FormControl<string>>();
  readonly newWeightModeControl = input.required<FormControl<WeightedGroupingMode>>();

  readonly addWeight = output<void>();
  readonly renameWeight = output<{ weight: CustomWeightDefinition; name: string }>();
  readonly updateWeightMode = output<{ weight: CustomWeightDefinition; mode: WeightedGroupingMode }>();
  readonly removeWeight = output<CustomWeightDefinition>();
}
