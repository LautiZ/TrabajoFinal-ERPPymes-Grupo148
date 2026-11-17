import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { AuthService } from '../../../../core/services/auth.service';
import { Register, registerErrorMessage } from './register';
import '@angular/compiler';
interface FormApi {
  patchValue: (value: Record<string, unknown>) => void;
  controls: Record<string, { errors: Record<string, unknown> | null; touched: boolean; value: unknown }>;
}

describe('Register', () => {
  let fixture: ComponentFixture<Register>;
  let auth: { createUser: Mock; role?: Mock };
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
      role: 'Employee',
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
    auth = { 
      createUser: vi.fn(() => of(undefined)),
      role: vi.fn(() => 'Owner') 
    };
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    navigate = vi.fn(() => Promise.resolve(true));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate as never);
    fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
  });

  it('muestra la pantalla de alta de usuario', () => {
    expect(text()).toContain('Alta de usuario');
  });

  describe('validaciones', () => {
    it('con el formulario vacío no envía y marca los campos obligatorios', () => {
      submit();

      expect(auth.createUser).not.toHaveBeenCalled();
      expect(text()).toContain('El nombre es obligatorio.');
      expect(text()).toContain('El email es obligatorio.');
      expect(text()).toContain('La contraseña es obligatoria.');
      expect(text()).toContain('Confirmá la contraseña.');
    });

    it('el apellido es opcional', () => {
      fill({ surname: '' });

      expect(form().controls['surname'].errors).toBeNull();
    });

    it('valida el formato del email', () => {
      fill({ email: 'no-es-un-email' });
      submit();

      expect(auth.createUser).not.toHaveBeenCalled();
      expect(text()).toContain('Ingresá un email válido.');
    });

    it('exige una contraseña con largo mínimo y complejidad', () => {
      fill({ password: 'corta1', confirmPassword: 'corta1' });
      submit();
      expect(text()).toContain('al menos 8 caracteres');
      expect(auth.createUser).not.toHaveBeenCalled();
    });
  });

  describe('envío y creación de usuario', () => {
    it('con datos válidos invoca al servicio de creación enviando el rol seleccionado', () => {
      fill({ name: ' Ana ', surname: ' Pérez ', role: 'Employee' });
      submit();

      expect(auth.createUser).toHaveBeenCalledWith({
        email: 'ana@example.com',
        password: 'Secreta123',
        name: 'Ana',
        surname: 'Pérez',
        role: 'Employee',
      });
    });

    it('deshabilita el botón mientras registra y previene doble envío', () => {
      const pending = new Subject<void>();
      auth.createUser.mockReturnValue(pending);
      fill();

      submit();
      expect(button().disabled).toBe(true);
      expect(text()).toContain('Creando usuario...');
      submit();

      expect(auth.createUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('errores del servidor', () => {
    it('un email ya registrado (409) se marca en el campo y no avanza', () => {
      auth.createUser.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
      fill();

      submit();

      expect(form().controls['email'].errors).toEqual({ duplicate: true });
      expect(text()).toContain('Ya existe un usuario con ese email.');
      expect(button().disabled).toBe(false);
    });

    it('un error de permisos (403) muestra el mensaje correspondiente', () => {
      auth.createUser.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 403,
              error: { message: 'No autorizado para crear este rol' },
            }),
        ),
      );
      fill();

      submit();

      expect(text()).toContain('No autorizado para crear este rol');
      expect(root().querySelector('[role=alert]')).not.toBeNull();
    });
  });
});

describe('registerErrorMessage', () => {
  const http = (status: number, body?: unknown): HttpErrorResponse =>
    new HttpErrorResponse({ status, error: body });

  it('para 403 usa el mensaje del servidor o uno por defecto', () => {
    expect(registerErrorMessage(http(403, { message: 'Prohibido' }))).toBe('Prohibido');
    expect(registerErrorMessage(http(403))).toContain('No tenés permisos para crear un usuario');
  });

  it('para errores de validación muestra lo que informa el servidor', () => {
    expect(registerErrorMessage(http(400, { message: 'Datos inválidos' }))).toBe('Datos inválidos');
  });
});