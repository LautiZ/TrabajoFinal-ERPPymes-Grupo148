import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const PASSWORD_MIN_LENGTH = 8;
/** Límite práctico: bcrypt solo considera los primeros 72 bytes de la contraseña. */
export const PASSWORD_MAX_LENGTH = 72;

/**
 * Política de contraseña del cliente: entre 8 y 72 caracteres, con al menos una letra y un número.
 * Es una validación de UX; el backend aplica su propia política y puede ser más estricta.
 */
export const passwordPolicy: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  const errors: ValidationErrors = {};
  if (value.length < PASSWORD_MIN_LENGTH) {
    errors['minLength'] = { min: PASSWORD_MIN_LENGTH };
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    errors['maxLength'] = { max: PASSWORD_MAX_LENGTH };
  }
  if (!/\p{L}/u.test(value) || !/\d/.test(value)) {
    errors['complexity'] = true;
  }
  return Object.keys(errors).length > 0 ? errors : null;
};

/**
 * Validador cruzado: el valor de este control debe ser igual al del control hermano indicado
 * (p. ej. la confirmación de contraseña). Hay que revalidarlo cuando cambia el otro control.
 */
export function sameAs(otherControlName: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(otherControlName);
    if (!other || control.value === '' || control.value === null) {
      return null;
    }
    return control.value === other.value ? null : { mismatch: true };
  };
}
