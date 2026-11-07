import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { AuthService } from '../../../../core/services/auth.service';
import { Register, registerErrorMessage } from './register';

interface FormApi {
  patchValue: (value: Record<string, unknown>) => void;
  controls: Record<string, { errors: Record<string, unknown> | null; touched: boolean }>;
}

describe('Register', () => {
  let fixture: ComponentFixture<Register>;
  let auth: { register: Mock };
  let navigate: Mock;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => root().textContent ?? '';
  const form = (): FormApi => (fixture.componentInstance as unknown as { form: FormApi }).form;
  const button = (): HTMLButtonElement =>
    root().querySelector('button[type=submit]') as HTMLButtonElement;

  function fill(overrides: Record<string, unknown> = {}): void {
    form().patchValue({
      name: 'Ana',
      surname: 'Pérez',
      email: 'ana@example.com',
      password: 'Secreta123',
      confirmPassword: 'Secreta123',
      ...overrides,
    });
  }

  function submit(): void {
    (root().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    auth = { register: vi.fn(() => of(undefined)) };
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    navigate = vi.fn(() => Promise.resolve(true));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate as never);
    fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
  });

  it('explica que el registro público es solo para el propietario', () => {
    expect(text()).toContain('Crear cuenta');
    expect(text()).toContain('solo para crear la cuenta del propietario');
  });

  describe('validaciones', () => {
    it('con el formulario vacío no envía y marca los campos obligatorios', () => {
      submit();

      expect(auth.register).not.toHaveBeenCalled();
      expect(text()).toContain('El nombre es obligatorio.');
      expect(text()).toContain('El email es obligatorio.');
      expect(text()).toContain('La contraseña es obligatoria.');
      expect(text()).toContain('Confirmá la contraseña.');
    });

    it('el apellido es opcional', () => {
      fill({ surname: '' });

      expect(form().controls['surname'].errors).toBeNull();
    });

    it('un nombre con solo espacios cuenta como vacío', () => {
      fill({ name: '   ' });

      expect(form().controls['name'].errors).toEqual({ required: true });
    });

    it('valida el formato del email', () => {
      fill({ email: 'no-es-un-email' });
      submit();

      expect(auth.register).not.toHaveBeenCalled();
      expect(text()).toContain('Ingresá un email válido.');
    });

    it('exige una contraseña con largo mínimo y complejidad', () => {
      fill({ password: 'corta1', confirmPassword: 'corta1' });
      submit();
      expect(text()).toContain('al menos 8 caracteres');

      fill({ password: 'sololetrasaqui', confirmPassword: 'sololetrasaqui' });
      fixture.detectChanges();
      expect(text()).toContain('al menos una letra y un número');
      expect(auth.register).not.toHaveBeenCalled();
    });

    it('la confirmación debe coincidir con la contraseña (validador cruzado)', () => {
      fill({ confirmPassword: 'Otra12345' });
      submit();

      expect(auth.register).not.toHaveBeenCalled();
      expect(text()).toContain('Las contraseñas no coinciden.');
    });

    it('si cambia la contraseña, se revalida la confirmación', () => {
      fill();
      expect(form().controls['confirmPassword'].errors).toBeNull();

      form().patchValue({ password: 'Distinta999' });

      expect(form().controls['confirmPassword'].errors).toEqual({ mismatch: true });
    });
  });

  describe('envío', () => {
    it('con datos válidos registra y lleva al login avisando que la cuenta fue creada', () => {
      fill({ name: '  Ana ', surname: ' Pérez ' });
      submit();

      expect(auth.register).toHaveBeenCalledWith({
        email: 'ana@example.com',
        password: 'Secreta123',
        name: 'Ana',
        surname: 'Pérez',
      });
      expect(navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { registered: '1' } });
    });

    it('sin apellido no lo envía', () => {
      fill({ surname: '  ' });
      submit();

      expect(auth.register.mock.calls[0][0]).not.toHaveProperty('surname');
    });

    it('no envía la confirmación de contraseña al servidor', () => {
      fill();
      submit();

      expect(auth.register.mock.calls[0][0]).not.toHaveProperty('confirmPassword');
    });

    it('deshabilita el botón mientras registra y no permite doble envío', () => {
      const pending = new Subject<void>();
      auth.register.mockReturnValue(pending);
      fill();

      submit();
      expect(button().disabled).toBe(true);
      expect(text()).toContain('Creando cuenta...');
      submit();

      expect(auth.register).toHaveBeenCalledTimes(1);
    });
  });

  describe('errores del servidor', () => {
    it('un email ya registrado (409) se marca en el campo y no navega', () => {
      auth.register.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
      fill();

      submit();

      expect(form().controls['email'].errors).toEqual({ duplicate: true });
      expect(text()).toContain('Ya existe un usuario con ese email.');
      expect(navigate).not.toHaveBeenCalled();
      expect(button().disabled).toBe(false);
    });

    it('un registro deshabilitado (403) muestra el mensaje del servidor', () => {
      auth.register.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 403,
              error: { message: 'El registro público está deshabilitado' },
            }),
        ),
      );
      fill();

      submit();

      expect(text()).toContain('El registro público está deshabilitado');
      expect(root().querySelector('[role=alert]')).not.toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('permite corregir y reintentar después de un error', () => {
      auth.register.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
      fill();
      submit();
      expect(text()).toContain('El servidor tuvo un problema');

      submit();

      expect(auth.register).toHaveBeenCalledTimes(2);
      expect(navigate).toHaveBeenCalled();
    });
  });

  it('permite mostrar y ocultar las contraseñas', () => {
    const fields = (): HTMLInputElement[] =>
      Array.from(root().querySelectorAll('input[autocomplete=new-password]'));
    expect(fields().map((f) => f.type)).toEqual(['password', 'password']);

    (root().querySelector('button[aria-pressed]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fields().map((f) => f.type)).toEqual(['text', 'text']);
  });

  it('ofrece volver al login', () => {
    expect(root().querySelector('a[href="/auth/login"]')).not.toBeNull();
  });
});

describe('registerErrorMessage', () => {
  const http = (status: number, body?: unknown): HttpErrorResponse =>
    new HttpErrorResponse({ status, error: body });

  it('para 403 usa el mensaje del servidor o uno que explica el registro de arranque', () => {
    expect(registerErrorMessage(http(403, { message: 'Deshabilitado' }))).toBe('Deshabilitado');
    expect(registerErrorMessage(http(403))).toContain('ya existe un propietario');
  });

  it('para errores de validación muestra lo que informa el servidor', () => {
    expect(registerErrorMessage(http(400, { message: ['password muy débil', 'name vacío'] }))).toBe(
      'password muy débil name vacío',
    );
    expect(registerErrorMessage(http(400))).toBe('Revisá los datos ingresados.');
  });

  it('distingue falta de conexión, errores del servidor y cualquier otro', () => {
    expect(registerErrorMessage(http(0))).toContain('No se pudo conectar');
    expect(registerErrorMessage(http(502))).toContain('El servidor tuvo un problema');
    expect(registerErrorMessage(new Error('x'))).toBe(
      'No se pudo crear la cuenta. Intentá nuevamente.',
    );
  });
});
