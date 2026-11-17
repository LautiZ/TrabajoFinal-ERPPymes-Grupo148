import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { LoadingSpinner } from '../../../../shared/components/loading-spinner/loading-spinner';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { NotificationService } from '../../../../shared/services/notification.service';
import {
  Category,
  CreateProductDto,
  PRODUCT_UNITS,
  Product,
  ProductUnit,
  UNIT_LABELS,
  UpdateProductDto,
} from '../../models/product.model';
import { InventoryService } from '../../services/inventory.service';
import { extractErrorMessage, isConflict, isNotFound } from '../../utils/api-error';
import { integerWhenUnit, maxDecimals, noInnerSpaces, notBlank } from '../../utils/validators';

/**
 * Formulario reutilizable de alta y edición de producto. El modo lo define la ruta:
 * `/inventory/new` crea; `/inventory/:id/edit` edita.
 *
 * En edición el stock y la unidad no se modifican desde acá: el stock nunca se edita
 * directamente (RN-01) y solo cambia con movimientos (ajuste de stock).
 */
@Component({
  selector: 'app-product-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    PageHeader,
    LoadingSpinner,
  ],
  templateUrl: './product-form.html',
  styleUrl: './product-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductForm {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly inventory = inject(InventoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly productId = this.route.snapshot.paramMap.get('id');
  protected readonly isEdit = this.productId !== null;

  protected readonly units = PRODUCT_UNITS;
  protected readonly unitLabels = UNIT_LABELS;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly categories = signal<Category[]>([]);

  protected readonly form = this.fb.group({
    name: this.fb.control('', [notBlank, Validators.maxLength(120)]),
    sku: this.fb.control('', [notBlank, Validators.maxLength(60), noInnerSpaces]),
    price: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      maxDecimals(2),
    ]),
    unit: this.fb.control<ProductUnit>('Unit', Validators.required),
    stock: this.fb.control<number | null>(0, [
      Validators.required,
      Validators.min(0),
      integerWhenUnit,
      maxDecimals(3),
    ]),
    categoryId: this.fb.control('', Validators.required),
    active: this.fb.control(true),
  });

  constructor() {
    // La unidad define si el stock puede tener decimales: hay que revalidarlo al cambiarla.
    this.form.controls.unit.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.stock.updateValueAndValidity());

    if (this.isEdit) {
      this.form.controls.stock.disable();
      this.form.controls.unit.disable();
    }
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    const product$: Observable<Product | null> = this.productId
      ? this.inventory.getById(this.productId)
      : of(null);

    forkJoin({ product: product$, categories: this.inventory.listCategories() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ product, categories }) => {
          if (product?.deleted) {
            this.fail('El producto no existe o fue dado de baja.');
            return;
          }
          this.categories.set(categories);
          if (product) {
            this.form.reset({
              name: product.name,
              sku: product.sku,
              price: product.price,
              unit: product.unit,
              stock: product.stock,
              categoryId: product.categoryId,
              active: product.active,
            });
          }
          this.loading.set(false);
        },
        error: (error: unknown) =>
          this.fail(
            isNotFound(error)
              ? 'El producto no existe o fue dado de baja.'
              : 'No se pudo cargar el formulario.',
          ),
      });
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.request()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notify.success(this.isEdit ? 'Producto actualizado.' : 'Producto creado.');
          void this.router.navigate(['/inventory']);
        },
        error: (error: unknown) => this.onSaveError(error),
      });
  }

  private request(): Observable<Product> {
    const value = this.form.getRawValue();
    const common = {
      name: value.name.trim(),
      sku: value.sku.trim(),
      price: Number(value.price),
      categoryId: value.categoryId,
      active: value.active,
    };

    if (this.productId) {
      const dto: UpdateProductDto = common;
      return this.inventory.update(this.productId, dto);
    }
    const dto: CreateProductDto = { ...common, unit: value.unit, stock: Number(value.stock) };
    return this.inventory.create(dto);
  }

  private onSaveError(error: unknown): void {
    this.saving.set(false);
    if (isConflict(error)) {
      // SKU único: se marca en el campo; el error se limpia solo cuando el usuario lo edita.
      this.form.controls.sku.setErrors({ duplicate: true });
      this.form.controls.sku.markAsTouched();
      return;
    }
    this.notify.error(extractErrorMessage(error, 'No se pudo guardar el producto.'));
  }

  private fail(message: string): void {
    this.loadError.set(message);
    this.loading.set(false);
  }
}
