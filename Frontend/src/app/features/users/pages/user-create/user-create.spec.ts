import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { CreatedUser, UserRole } from '../../../../core/models/auth.model';
import { AuthService } from '../../../../core/services/auth.service';
import { creatableRoles } from '../../../../core/utils/user-creation';
import { NotificationService } from '../../../../shared/services/notification.service';
import { UserCreate } from './user-create';

const CREATED: CreatedUser = {
  id: 'u9',
  email: 'nuevo@pyme.test',
  name: 'Nora',
  surname: 'Gómez',
  role: 'Admin',
  active: true,
  createdAt: '2026-11-19T00:00:00.000Z',
};

describe('UserCreate', () => {
  let fixture: ComponentFixture<UserCreate>;
  let auth: { creatableRoles: ReturnType<typeof signal<readonly UserRole[]>>; createUser: Mock };
  let notify: { success: Mock; error: Mock };

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const form = (): UserCreate['form'] =>
    (fixture.componentInstance as unknown as { form: UserCreate['form'] }).form;
  const submit = (): void => {
    (fixture.componentInstance as unknown as { submit: () => void }).submit();
    fixture.detectChanges();
  };
  const fill = (overrides: Record<string, string> = {}): void => {
    form().patchValue({
      name: 'Nora',
      surname: 'Gómez',
      email: 'nuevo@pyme.test',
      password: 'Cambiar123!',
      ...overrides,
    });
  };

  async function create(actor: UserRole): Promise<void> {
    auth = {
      creatableRoles: signal(creatableRoles(actor)),
      createUser: vi.fn(() => of(CREATED)),
    };
    notify = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [UserCreate],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: notify },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(UserCreate);
    fixture.detectChanges();
  }

  describe('como Owner', () => {
    beforeEach(() => create('Owner'));

    it('ofrece Admin y Employee, con Admin preseleccionado', () => {
      expect(form().controls.role.value).toBe('Admin');
      expect(form().controls.role.enabled).toBe(true);
      expect(el().textContent).toContain('administrador o de empleado');
    });

    it('crea un administrador con los datos limpios y avisa', () => {
      fill({ name: '  Nora  ', email: '  NUEVO@Pyme.test ' });

      submit();

      expect(auth.createUser).toHaveBeenCalledWith({
        email: 'nuevo@pyme.test',
        password: 'Cambiar123!',
        name: 'Nora',
        surname: 'Gómez',
        role: 'Admin',
      });
      expect(notify.success).toHaveBeenCalledWith(
        'Usuario nuevo@pyme.test creado como Administrador.',
      );
    });

    it('al terminar deja el formulario limpio para cargar otra cuenta', () => {
      fill();

      submit();

      expect(form().controls.email.value).toBe('');
      expect(form().controls.password.value).toBe('');
      expect(form().controls.role.value).toBe('Admin');
    });

    it('tras crear, el formulario queda sin errores de "obligatorio"', () => {
      fill();

      submit();

      expect(el().querySelector('mat-error')).toBeNull();
      expect(form().controls.name.touched).toBe(false);
    });

    it('puede crear un empleado', () => {
      fill();
      form().patchValue({ role: 'Employee' });

      submit();

      expect(auth.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'Employee' }));
    });

    it('sin apellido no lo envía', () => {
      fill({ surname: '   ' });

      submit();

      const body = auth.createUser.mock.calls[0][0] as Record<string, unknown>;
      expect('surname' in body).toBe(false);
    });
  });

  describe('como Admin', () => {
    beforeEach(() => create('Admin'));

    it('solo puede crear empleados y el rol queda fijo', () => {
      expect(auth.creatableRoles()).toEqual(['Employee']);
      expect(form().controls.role.value).toBe('Employee');
      expect(form().controls.role.disabled).toBe(true);
      expect(el().textContent).toContain('solo pueden crear empleados');
    });

    it('envía el rol Employee aunque el control esté deshabilitado', () => {
      fill();

      submit();

      expect(auth.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'Employee' }));
    });

    it('si alguien fuerza un rol que no le corresponde, no llama al backend', () => {
      fill();
      form().controls.role.setValue('Admin');

      submit();

      expect(auth.createUser).not.toHaveBeenCalled();
      expect(notify.error).toHaveBeenCalledWith('Tu rol no puede crear este tipo de usuario.');
    });
  });

  describe('validaciones', () => {
    beforeEach(() => create('Owner'));

    it('con el formulario vacío no llama al backend y marca los obligatorios', () => {
      submit();

      expect(auth.createUser).not.toHaveBeenCalled();
      const text = el().textContent ?? '';
      expect(text).toContain('El nombre es obligatorio.');
      expect(text).toContain('El email es obligatorio.');
      expect(text).toContain('La contraseña es obligatoria.');
    });

    it('rechaza un nombre de solo espacios', () => {
      fill({ name: '    ' });
      expect(form().controls.name.errors).toEqual({ required: true });
    });

    it('rechaza un email inválido', () => {
      fill({ email: 'no-es-un-email' });
      expect(form().controls.email.errors).toHaveProperty('email');
    });

    it('la contraseña debe tener entre 8 y 128 caracteres', () => {
      fill({ password: 'corta' });
      expect(form().controls.password.errors).toHaveProperty('minlength');
      fill({ password: 'x'.repeat(129) });
      expect(form().controls.password.errors).toHaveProperty('maxlength');
      fill({ password: 'x'.repeat(8) });
      expect(form().controls.password.errors).toBeNull();
    });

    it('permite mostrar y ocultar la contraseña', () => {
      const input = (): HTMLInputElement =>
        el().querySelector('input[formControlName=password]') as HTMLInputElement;
      expect(input().type).toBe('password');

      (el().querySelector('button[aria-label="Mostrar contraseña"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(input().type).toBe('text');
    });
  });

  describe('errores del backend', () => {
    beforeEach(() => create('Owner'));

    it('un email repetido (409) se marca en el campo y no limpia el formulario', () => {
      auth.createUser.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
      fill();

      submit();

      expect(form().controls.email.errors).toEqual({ duplicate: true });
      expect(el().textContent).toContain('Ya existe un usuario con ese email.');
      expect(form().controls.name.value).toBe('Nora');
      expect(notify.success).not.toHaveBeenCalled();
    });

    it('un 403 informa que el rol no alcanza', () => {
      auth.createUser.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
      fill();

      submit();

      expect(notify.error).toHaveBeenCalledWith('Tu rol no puede crear este tipo de usuario.');
    });

    it('muestra el mensaje de validación del backend (400)', () => {
      auth.createUser.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 400, error: { message: ['email must be an email'] } }),
        ),
      );
      fill();

      submit();

      expect(notify.error).toHaveBeenCalledWith('email must be an email');
    });

    it('sin conexión lo informa y deja volver a intentar', () => {
      auth.createUser.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
      fill();

      submit();

      expect(notify.error).toHaveBeenCalledWith(
        'No se pudo conectar con el servidor. Revisá tu conexión.',
      );
      const button = el().querySelector('button[type=submit]') as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
  });
});
