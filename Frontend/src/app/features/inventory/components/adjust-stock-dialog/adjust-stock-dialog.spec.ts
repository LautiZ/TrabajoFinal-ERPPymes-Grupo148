import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { Mock } from 'vitest';
import { Product } from '../../models/product.model';
import { createProduct } from '../../testing/factories';
import { AdjustStockDialog } from './adjust-stock-dialog';

interface FormApi {
  controls: Record<string, { errors: Record<string, unknown> | null }>;
  patchValue: (value: Record<string, unknown>) => void;
}

describe('AdjustStockDialog', () => {
  let fixture: ComponentFixture<AdjustStockDialog>;
  let dialogRef: { close: Mock };

  const form = (): FormApi => (fixture.componentInstance as unknown as { form: FormApi }).form;
  const call = (method: string): void =>
    (fixture.componentInstance as unknown as Record<string, () => void>)[method]();
  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function create(product: Product = createProduct({ stock: 10 })): Promise<void> {
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdjustStockDialog],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { product } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdjustStockDialog);
    fixture.detectChanges();
  }

  it('muestra el producto y su stock actual', async () => {
    await create();

    expect(text()).toContain('Yerba Mate 1kg');
    expect(text()).toContain('Stock actual: 10 u');
  });

  it('sin cantidad ni motivo no cierra y marca qué falta', async () => {
    await create();

    call('submit');
    fixture.detectChanges();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(text()).toContain('La cantidad es obligatoria.');
    expect(text()).toContain('Indicá el motivo del ajuste.');
  });

  it('valida la cantidad: positiva y entera para productos por unidad', async () => {
    await create();

    form().patchValue({ quantity: 0 });
    expect(form().controls['quantity'].errors).toHaveProperty('min');
    form().patchValue({ quantity: -2 });
    expect(form().controls['quantity'].errors).toHaveProperty('min');
    form().patchValue({ quantity: 1.5 });
    expect(form().controls['quantity'].errors).toHaveProperty('integer');
    form().patchValue({ quantity: 3 });
    expect(form().controls['quantity'].errors).toBeNull();
  });

  it('admite cantidades decimales en productos por peso', async () => {
    await create(createProduct({ unit: 'Kg', stock: 10 }));

    form().patchValue({ quantity: 1.25 });

    expect(form().controls['quantity'].errors).toBeNull();
  });

  it('un egreso no puede dejar el stock en negativo (RN-02)', async () => {
    await create();

    form().patchValue({ type: 'Outcome', quantity: 11 });
    expect(form().controls['quantity'].errors).toEqual({ exceedsStock: { max: 10 } });

    form().patchValue({ quantity: 10 });
    expect(form().controls['quantity'].errors).toBeNull();
  });

  it('un ingreso no tiene tope, y cambiar el tipo revalida la cantidad', async () => {
    await create();

    form().patchValue({ type: 'Outcome', quantity: 50 });
    expect(form().controls['quantity'].errors).toHaveProperty('exceedsStock');

    form().patchValue({ type: 'Income' });
    expect(form().controls['quantity'].errors).toBeNull();
  });

  it('el motivo es obligatorio y no acepta solo espacios', async () => {
    await create();

    form().patchValue({ reason: '    ' });

    expect(form().controls['reason'].errors).toEqual({ required: true });
  });

  it('muestra el stock resultante según el tipo de movimiento', async () => {
    await create();

    form().patchValue({ type: 'Income', quantity: 5 });
    fixture.detectChanges();
    expect(text()).toContain('Stock resultante: 15 u');

    form().patchValue({ type: 'Outcome', quantity: 4 });
    fixture.detectChanges();
    expect(text()).toContain('Stock resultante: 6 u');
  });

  it('al confirmar devuelve el movimiento con el motivo recortado', async () => {
    await create();
    form().patchValue({ type: 'Outcome', quantity: 3, reason: '  Merma por rotura  ' });

    call('submit');

    expect(dialogRef.close).toHaveBeenCalledWith({
      type: 'Outcome',
      quantity: 3,
      reason: 'Merma por rotura',
    });
  });

  it('al cancelar cierra sin devolver nada', async () => {
    await create();

    call('cancel');

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });
});
