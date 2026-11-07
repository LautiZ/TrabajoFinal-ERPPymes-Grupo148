import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { NotificationService } from '../../../../shared/services/notification.service';
import { InventoryService } from '../../services/inventory.service';
import { createCategory, createProduct } from '../../testing/factories';
import { ProductForm } from './product-form';

interface FormApi {
  controls: Record<
    string,
    { errors: Record<string, unknown> | null; disabled: boolean; touched: boolean }
  >;
  patchValue: (value: Record<string, unknown>) => void;
  getRawValue: () => Record<string, unknown>;
  valid: boolean;
}

describe('ProductForm', () => {
  let fixture: ComponentFixture<ProductForm>;
  let inventory: {
    getById: Mock;
    listCategories: Mock;
    create: Mock;
    update: Mock;
  };
  let notify: { success: Mock; error: Mock };
  let navigate: Mock;

  const form = (): FormApi => (fixture.componentInstance as unknown as { form: FormApi }).form;
  const call = (method: string): void =>
    (fixture.componentInstance as unknown as Record<string, () => void>)[method]();
  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function fillValid(overrides: Record<string, unknown> = {}): void {
    form().patchValue({
      name: 'Yerba Mate 1kg',
      sku: 'YER-001',
      price: 4500,
      unit: 'Unit',
      stock: 10,
      categoryId: 'c1',
      active: true,
      ...overrides,
    });
  }

  async function create(id: string | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProductForm],
      providers: [
        provideRouter([]),
        { provide: InventoryService, useValue: inventory },
        { provide: NotificationService, useValue: notify },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    }).compileComponents();
    navigate = vi.fn(() => Promise.resolve(true));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate as never);
    fixture = TestBed.createComponent(ProductForm);
    fixture.detectChanges();
  }

  beforeEach(() => {
    inventory = {
      getById: vi.fn(() => of(createProduct({ id: 'p1', stock: 7, price: 4500 }))),
      listCategories: vi.fn(() =>
        of([createCategory(), createCategory({ id: 'c2', name: 'Granos' })]),
      ),
      create: vi.fn(() => of(createProduct())),
      update: vi.fn(() => of(createProduct())),
    };
    notify = { success: vi.fn(), error: vi.fn() };
  });

  describe('alta', () => {
    beforeEach(async () => {
      await create(null);
    });

    it('arranca vacío, activo y con stock inicial en 0', () => {
      expect(text()).toContain('Nuevo producto');
      expect(text()).toContain('Stock inicial');
      expect(form().getRawValue()).toMatchObject({
        name: '',
        sku: '',
        price: null,
        stock: 0,
        active: true,
      });
      expect(inventory.getById).not.toHaveBeenCalled();
    });

    it('con el formulario vacío no crea nada y marca qué falta', () => {
      call('submit');
      fixture.detectChanges();

      expect(inventory.create).not.toHaveBeenCalled();
      expect(text()).toContain('El nombre es obligatorio.');
      expect(text()).toContain('El SKU es obligatorio.');
      expect(text()).toContain('El precio es obligatorio.');
      expect(text()).toContain('Elegí una categoría.');
    });

    it('valida nombre: no acepta solo espacios', () => {
      fillValid({ name: '    ' });
      expect(form().controls['name'].errors).toEqual({ required: true });
    });

    it('valida precio: debe ser mayor a 0 y tener hasta 2 decimales', () => {
      fillValid({ price: 0 });
      expect(form().controls['price'].errors).toHaveProperty('min');
      fillValid({ price: -5 });
      expect(form().controls['price'].errors).toHaveProperty('min');
      fillValid({ price: 10.999 });
      expect(form().controls['price'].errors).toHaveProperty('maxDecimals');
      fillValid({ price: 0.01 });
      expect(form().controls['price'].errors).toBeNull();
    });

    it('valida stock: entero y no negativo para productos por unidad', () => {
      fillValid({ stock: 1.5 });
      expect(form().controls['stock'].errors).toHaveProperty('integer');
      fillValid({ stock: -1 });
      expect(form().controls['stock'].errors).toHaveProperty('min');
      fillValid({ stock: 0 });
      expect(form().controls['stock'].errors).toBeNull();
    });

    it('admite stock decimal en Kg y revalida al cambiar la unidad', () => {
      fillValid({ unit: 'Kg', stock: 1.5 });
      expect(form().controls['stock'].errors).toBeNull();

      form().patchValue({ unit: 'Unit' });
      expect(form().controls['stock'].errors).toHaveProperty('integer');
    });

    it('valida SKU: sin espacios', () => {
      fillValid({ sku: 'YER 001' });
      expect(form().controls['sku'].errors).toHaveProperty('pattern');
    });

    it('crea el producto con los datos limpios, avisa y vuelve al listado', () => {
      fillValid({ name: '  Yerba Mate  ', sku: ' YER-001 ', price: 4500, stock: 10 });

      call('submit');

      expect(inventory.create).toHaveBeenCalledWith({
        name: 'Yerba Mate',
        sku: 'YER-001',
        price: 4500,
        stock: 10,
        unit: 'Unit',
        categoryId: 'c1',
        active: true,
      });
      expect(notify.success).toHaveBeenCalledWith('Producto creado.');
      expect(navigate).toHaveBeenCalledWith(['/inventory']);
    });

    it('un SKU repetido (409) se marca en el campo y no navega', () => {
      inventory.create.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
      fillValid();

      call('submit');
      fixture.detectChanges();

      expect(form().controls['sku'].errors).toEqual({ duplicate: true });
      expect(text()).toContain('Ya existe un producto con ese SKU.');
      expect(navigate).not.toHaveBeenCalled();
      expect(notify.success).not.toHaveBeenCalled();
    });

    it('otros errores muestran el mensaje del servidor y permiten reintentar', () => {
      inventory.create.mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 400, error: { message: 'Categoría inexistente' } }),
        ),
      );
      fillValid();

      call('submit');
      expect(notify.error).toHaveBeenCalledWith('Categoría inexistente');

      call('submit');
      expect(inventory.create).toHaveBeenCalledTimes(2);
      expect(navigate).toHaveBeenCalledWith(['/inventory']);
    });
  });

  describe('edición', () => {
    it('precarga los datos del producto y bloquea stock y unidad (RN-01)', async () => {
      await create('p1');

      expect(inventory.getById).toHaveBeenCalledWith('p1');
      expect(text()).toContain('Editar producto');
      expect(form().getRawValue()).toMatchObject({
        name: 'Yerba Mate 1kg',
        sku: 'YER-001',
        price: 4500,
        stock: 7,
        categoryId: 'c1',
        active: true,
      });
      expect(form().controls['stock'].disabled).toBe(true);
      expect(form().controls['unit'].disabled).toBe(true);
    });

    it('guarda solo los campos editables, sin enviar el stock', async () => {
      await create('p1');
      form().patchValue({ price: 5000, active: false });

      call('submit');

      expect(inventory.update).toHaveBeenCalledWith('p1', {
        name: 'Yerba Mate 1kg',
        sku: 'YER-001',
        price: 5000,
        categoryId: 'c1',
        active: false,
      });
      expect(inventory.create).not.toHaveBeenCalled();
      expect(notify.success).toHaveBeenCalledWith('Producto actualizado.');
      expect(navigate).toHaveBeenCalledWith(['/inventory']);
    });

    it('si el producto no existe (404) lo informa y ofrece volver', async () => {
      inventory.getById.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      await create('nope');

      expect(text()).toContain('El producto no existe o fue dado de baja.');
      expect(text()).toContain('Volver al inventario');
      expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
    });

    it('si el producto fue dado de baja no permite editarlo', async () => {
      inventory.getById.mockReturnValue(of(createProduct({ deleted: true })));
      await create('p1');

      expect(text()).toContain('El producto no existe o fue dado de baja.');
    });

    it('si falla la carga ofrece reintentar', async () => {
      inventory.getById.mockReturnValueOnce(throwError(() => new Error('down')));
      await create('p1');
      expect(text()).toContain('No se pudo cargar el formulario.');

      call('load');
      fixture.detectChanges();

      expect(inventory.getById).toHaveBeenCalledTimes(2);
      expect((fixture.nativeElement as HTMLElement).querySelector('form')).not.toBeNull();
    });
  });
});
