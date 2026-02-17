import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { CustomWeightDefinition } from '../../../../../models/session.model';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-custom-weights-card',
  templateUrl: './custom-weights-card.html',
  styleUrl: './custom-weights-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    TranslatePipe,
  ],
})
export class CustomWeightsCard {
  readonly customWeights = input.required<CustomWeightDefinition[]>();
  readonly newWeightNameControl = input.required<FormControl<string>>();

  readonly addWeight = output<void>();
  readonly renameWeight = output<{ weight: CustomWeightDefinition; name: string }>();
  readonly removeWeight = output<CustomWeightDefinition>();
}
