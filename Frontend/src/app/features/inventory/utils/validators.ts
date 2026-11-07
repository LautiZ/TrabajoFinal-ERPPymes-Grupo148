import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ProductUnit, allowsDecimals } from '../models/product.model';

/** Rechaza valores vacíos o con solo espacios (`Validators.required` los dejaría pasar). */
export const notBlank: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true };

/** Limita la cantidad de decimales (p. ej. 2 para precios, 3 para cantidades). */
export function maxDecimals(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const decimals = (String(value).split('.')[1] ?? '').length;
    return decimals > max ? { maxDecimals: { max } } : null;
  };
}

/**
 * RN-05: si la unidad del producto es `Unit` la cantidad debe ser entera. Lee la unidad del
 * control hermano `unit`, por lo que hay que revalidar este control cuando la unidad cambie.
 */
export const integerWhenUnit: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const unit = control.parent?.get('unit')?.value as ProductUnit | undefined;
  const value = control.value;
  if (value === null || value === undefined || value === '' || !unit) {
    return null;
  }
  return !allowsDecimals(unit) && !Number.isInteger(Number(value)) ? { integer: true } : null;
};

/** Rechaza espacios dentro del valor; los de los bordes se ignoran porque el formulario los recorta. */
export const noInnerSpaces: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && /\s/.test(control.value.trim()) ? { pattern: true } : null;
