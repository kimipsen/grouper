import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { GenderMode, GroupingStrategy } from '../../../../../models/group.model';
import { CustomWeightDefinition } from '../../../../../models/session.model';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-grouping-config-card',
  templateUrl: './grouping-config-card.html',
  styleUrl: './grouping-config-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    TranslatePipe,
  ],
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

  readonly generateGroups = output<void>();
  readonly resetSession = output<void>();
  readonly toggleWeightSelection = output<string>();

  readonly GroupingStrategy = GroupingStrategy;
}
