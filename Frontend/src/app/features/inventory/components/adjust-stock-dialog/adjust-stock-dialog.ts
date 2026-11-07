import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { startWith } from 'rxjs';
import {
  AdjustStockDto,
  Product,
  StockMovementType,
  UNIT_SYMBOLS,
} from '../../models/product.model';
import {
  integerForUnit,
  maxDecimals,
  notBlank,
  withinStockOnOutcome,
} from '../../utils/validators';

export interface AdjustStockDialogData {
  product: Product;
}

/** Ingreso o egreso manual de stock con motivo. Devuelve el movimiento o `undefined` si se cancela. */
@Component({
  selector: 'app-adjust-stock-dialog',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Ajustar stock</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="content">
        <p class="summary">
          <strong>{{ product.name }}</strong>
          <span> Stock actual: {{ product.stock | number: '1.0-3' }} {{ unitSymbol }} </span>
        </p>

        <mat-form-field appearance="outline">
          <mat-label>Tipo de movimiento</mat-label>
          <mat-select formControlName="type">
            <mat-option value="Income">Ingreso</mat-option>
            <mat-option value="Outcome">Egreso</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Cantidad ({{ unitSymbol }})</mat-label>
          <input matInput type="number" step="any" min="0" formControlName="quantity" required />
          @if (form.controls.quantity.hasError('required')) {
            <mat-error>La cantidad es obligatoria.</mat-error>
          } @else if (form.controls.quantity.hasError('min')) {
            <mat-error>La cantidad debe ser mayor a 0.</mat-error>
          } @else if (form.controls.quantity.hasError('integer')) {
            <mat-error>Este producto se mide por unidad: ingresá un número entero.</mat-error>
          } @else if (form.controls.quantity.hasError('maxDecimals')) {
            <mat-error>Máximo 3 decimales.</mat-error>
          } @else if (form.controls.quantity.hasError('exceedsStock')) {
            <mat-error>
              No podés retirar más que el stock actual ({{ product.stock | number: '1.0-3' }}).
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Motivo</mat-label>
          <input matInput formControlName="reason" autocomplete="off" required />
          @if (form.controls.reason.hasError('required')) {
            <mat-error>Indicá el motivo del ajuste.</mat-error>
          } @else if (form.controls.reason.hasError('maxlength')) {
            <mat-error>Máximo 200 caracteres.</mat-error>
          }
        </mat-form-field>

        @if (resulting() !== null) {
          <p class="result" aria-live="polite">
            Stock resultante: <strong>{{ resulting() | number: '1.0-3' }} {{ unitSymbol }}</strong>
          </p>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="cancel()">Cancelar</button>
        <button mat-flat-button type="submit">Registrar ajuste</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      min-width: min(26rem, 80vw);
    }
    .summary {
      display: flex;
      flex-direction: column;
      margin: 0 0 1rem;
      color: var(--app-text-muted);
    }
    .summary strong {
      color: var(--app-text);
    }
    .result {
      margin: 0;
      color: var(--app-text-muted);
    }
  `,
})
export class AdjustStockDialog {
  private readonly dialogRef =
    inject<MatDialogRef<AdjustStockDialog, AdjustStockDto | undefined>>(MatDialogRef);
  protected readonly product = inject<AdjustStockDialogData>(MAT_DIALOG_DATA).product;
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly unitSymbol = UNIT_SYMBOLS[this.product.unit];

  protected readonly form = this.fb.group({
    type: this.fb.control<StockMovementType>('Income', Validators.required),
    quantity: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.001),
      maxDecimals(3),
      integerForUnit(this.product.unit),
      withinStockOnOutcome(this.product.stock),
    ]),
    reason: this.fb.control('', [notBlank, Validators.maxLength(200)]),
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  /** Stock que quedaría tras el movimiento, o `null` si todavía no hay una cantidad válida. */
  protected readonly resulting = computed(() => {
    const { type, quantity } = this.value();
    const amount = Number(quantity);
    if (quantity === null || quantity === undefined || !Number.isFinite(amount) || amount <= 0) {
      return null;
    }
    return type === 'Outcome' ? this.product.stock - amount : this.product.stock + amount;
  });

  constructor() {
    // El límite del egreso depende del tipo: hay que revalidar la cantidad al cambiarlo.
    this.form.controls.type.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.quantity.updateValueAndValidity());
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { type, quantity, reason } = this.form.getRawValue();
    this.dialogRef.close({ type, quantity: Number(quantity), reason: reason.trim() });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
