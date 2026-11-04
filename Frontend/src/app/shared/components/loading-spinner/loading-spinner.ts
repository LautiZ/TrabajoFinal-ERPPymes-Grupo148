import { Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-spinner',
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="spinner-container">
      <mat-progress-spinner mode="indeterminate" [diameter]="diameter()"></mat-progress-spinner>
      @if (message()) {
        <p class="spinner-message">{{ message() }}</p>
      }
    </div>
  `,
  styles: `
    .spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      gap: 0.75rem;
    }
    .spinner-message {
      color: #64748b;
      font-size: 0.875rem;
      margin: 0;
    }
  `,
})
export class LoadingSpinner {
  diameter = input<number>(40);
  message = input<string>('');
}
