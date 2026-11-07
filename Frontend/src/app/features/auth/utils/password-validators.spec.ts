import { FormControl, FormGroup } from '@angular/forms';
import { passwordPolicy, sameAs } from './password-validators';

describe('passwordPolicy', () => {
  const check = (value: string | null): unknown => passwordPolicy(new FormControl(value));

  it('acepta una contraseña de 8 a 72 caracteres con letras y números', () => {
    expect(check('Secreta123')).toBeNull();
    expect(check('abcdefg1')).toBeNull();
    expect(check('Contraseña2024')).toBeNull();
    expect(check('a1'.repeat(36))).toBeNull();
  });

  it('rechaza las demasiado cortas', () => {
    expect(check('Ab1')).toMatchObject({ minLength: { min: 8 } });
    expect(check('abc1234')).toMatchObject({ minLength: { min: 8 } });
  });

  it('rechaza las demasiado largas', () => {
    expect(check('a1'.repeat(37))).toMatchObject({ maxLength: { max: 72 } });
  });

  it('exige al menos una letra y un número', () => {
    expect(check('soloLetrasAqui')).toMatchObject({ complexity: true });
    expect(check('123456789')).toMatchObject({ complexity: true });
    expect(check('!!!!!!!!!')).toMatchObject({ complexity: true });
  });

  it('puede informar varios problemas a la vez', () => {
    expect(check('abc')).toEqual({ minLength: { min: 8 }, complexity: true });
  });

  it('no valida el campo vacío (de eso se ocupa required)', () => {
    expect(check('')).toBeNull();
    expect(check(null)).toBeNull();
  });
});

describe('sameAs', () => {
  function group(password: string, confirm: string): FormControl<string> {
    const confirmControl = new FormControl(confirm, {
      nonNullable: true,
      validators: sameAs('password'),
    });
    new FormGroup({ password: new FormControl(password), confirm: confirmControl });
    confirmControl.updateValueAndValidity();
    return confirmControl;
  }

  it('acepta cuando los dos valores coinciden', () => {
    expect(group('Secreta123', 'Secreta123').errors).toBeNull();
  });

  it('rechaza cuando difieren, incluso por una mayúscula', () => {
    expect(group('Secreta123', 'secreta123').errors).toEqual({ mismatch: true });
    expect(group('Secreta123', 'Secreta12').errors).toEqual({ mismatch: true });
  });

  it('no valida si la confirmación está vacía o si el control no tiene grupo', () => {
    expect(group('Secreta123', '').errors).toBeNull();
    expect(sameAs('password')(new FormControl('x'))).toBeNull();
  });

  it('se revalida cuando cambia el otro control', () => {
    const password = new FormControl('Secreta123');
    const confirm = new FormControl('Secreta123', sameAs('password'));
    new FormGroup({ password, confirm });
    expect(confirm.errors).toBeNull();

    password.setValue('Otra12345');
    confirm.updateValueAndValidity();

    expect(confirm.errors).toEqual({ mismatch: true });
  });
});
