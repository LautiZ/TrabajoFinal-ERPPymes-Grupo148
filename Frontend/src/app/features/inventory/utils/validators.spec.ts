import { FormControl, FormGroup } from '@angular/forms';
import { ProductUnit } from '../models/product.model';
import { integerWhenUnit, maxDecimals, noInnerSpaces, notBlank } from './validators';

describe('notBlank', () => {
  it('rechaza vacío, solo espacios y no-strings', () => {
    expect(notBlank(new FormControl(''))).toEqual({ required: true });
    expect(notBlank(new FormControl('   '))).toEqual({ required: true });
    expect(notBlank(new FormControl(null))).toEqual({ required: true });
  });

  it('acepta texto con contenido', () => {
    expect(notBlank(new FormControl(' Yerba '))).toBeNull();
  });
});

describe('maxDecimals', () => {
  const twoDecimals = maxDecimals(2);

  it('acepta enteros y hasta la cantidad indicada de decimales', () => {
    expect(twoDecimals(new FormControl(10))).toBeNull();
    expect(twoDecimals(new FormControl(10.5))).toBeNull();
    expect(twoDecimals(new FormControl(10.55))).toBeNull();
  });

  it('rechaza más decimales de los permitidos', () => {
    expect(twoDecimals(new FormControl(10.555))).toEqual({ maxDecimals: { max: 2 } });
  });

  it('no valida valores vacíos (de eso se ocupa required)', () => {
    expect(twoDecimals(new FormControl(null))).toBeNull();
    expect(twoDecimals(new FormControl(''))).toBeNull();
  });
});

describe('integerWhenUnit', () => {
  function group(unit: ProductUnit, stock: number | null): FormControl<number | null> {
    const stockControl = new FormControl<number | null>(stock, integerWhenUnit);
    new FormGroup({ unit: new FormControl<ProductUnit>(unit), stock: stockControl });
    stockControl.updateValueAndValidity();
    return stockControl;
  }

  it('exige enteros cuando la unidad es Unit', () => {
    expect(group('Unit', 1.5).errors).toEqual({ integer: true });
    expect(group('Unit', 2).errors).toBeNull();
  });

  it('admite decimales en Kg, Meter y Liter (RN-05)', () => {
    expect(group('Kg', 1.5).errors).toBeNull();
    expect(group('Meter', 0.25).errors).toBeNull();
    expect(group('Liter', 3.333).errors).toBeNull();
  });

  it('no valida si no hay valor o si el control no tiene grupo', () => {
    expect(group('Unit', null).errors).toBeNull();
    expect(integerWhenUnit(new FormControl(1.5))).toBeNull();
  });
});

describe('noInnerSpaces', () => {
  it('rechaza espacios dentro del valor', () => {
    expect(noInnerSpaces(new FormControl('YER 001'))).toEqual({ pattern: true });
    expect(noInnerSpaces(new FormControl('YER\t001'))).toEqual({ pattern: true });
  });

  it('ignora los espacios de los bordes y acepta valores vacíos', () => {
    expect(noInnerSpaces(new FormControl(' YER-001 '))).toBeNull();
    expect(noInnerSpaces(new FormControl('YER-001'))).toBeNull();
    expect(noInnerSpaces(new FormControl(''))).toBeNull();
  });
});
