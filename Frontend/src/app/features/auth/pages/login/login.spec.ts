import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { AuthUser } from '../../../../core/models/auth.model';
import { AuthService } from '../../../../core/services/auth.service';
import { Login, loginErrorMessage, loginNotice } from './login';

const USER: AuthUser = { id: 'u1', email: 'ana@example.com', name: 'Ana', role: 'Employee' };

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let auth: { login: Mock };
  let navigateByUrl: Mock;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => root().textContent ?? '';
  const button = (): HTMLButtonElement =>
    root().querySelector('button[type=submit]') as HTMLButtonElement;

  function type(selector: string, value: string): void {
    const input = root().querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function fill(email = 'ana@example.com', password = 'Secreta123'): void {
    type('input[type=email]', email);
    type('input[formControlName=password]', password);
  }

  function submit(): void {
    (root().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  async function create(query: Record<string, string> = {}): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    }).compileComponents();
    navigateByUrl = vi.fn(() => Promise.resolve(true));
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(navigateByUrl as never);
    fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
  }

  beforeEach(() => {
    auth = { login: vi.fn(() => of(USER)) };
  });

  describe('formulario', () => {
    beforeEach(() => create());

    it('muestra los campos y el botón de ingreso', () => {
      expect(text()).toContain('Iniciar sesión');
      expect(root().querySelector('input[type=email]')).not.toBeNull();
      expect(root().querySelector('input[formControlName=password]')).not.toBeNull();
      expect(button().textContent).toContain('Ingresar');
    });

    it('con los campos vacíos no intenta ingresar y marca qué falta', () => {
      submit();

      expect(auth.login).not.toHaveBeenCalled();
      expect(text()).toContain('El email es obligatorio.');
      expect(text()).toContain('La contraseña es obligatoria.');
    });

    it('con un email inválido no intenta ingresar', () => {
      fill('esto-no-es-un-email', 'Secreta123');
      submit();

      expect(auth.login).not.toHaveBeenCalled();
      expect(text()).toContain('Ingresá un email válido.');
    });

    it('con datos válidos ingresa enviando el email sin espacios y la contraseña tal cual', () => {
      fill('  ana@example.com  ', ' Secreta 123 ');
      submit();

      expect(auth.login).toHaveBeenCalledWith({
        email: 'ana@example.com',
        password: ' Secreta 123 ',
      });
    });

    it('ofrece ir a crear una cuenta', () => {
      const link = root().querySelector('a[href="/auth/register"]');

      expect(link?.textContent).toContain('Crear cuenta');
    });

    it('permite mostrar y ocultar la contraseña', () => {
      const field = (): HTMLInputElement =>
        root().querySelector('input[formControlName=password]') as HTMLInputElement;
      const toggle = (): HTMLButtonElement =>
        root().querySelector('button[aria-pressed]') as HTMLButtonElement;
      expect(field().type).toBe('password');
      expect(toggle().getAttribute('aria-label')).toBe('Mostrar contraseña');

      toggle().click();
      fixture.detectChanges();

      expect(field().type).toBe('text');
      expect(toggle().getAttribute('aria-label')).toBe('Ocultar contraseña');
      expect(toggle().getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('después de ingresar', () => {
    it('va al panel si no había una ruta pedida', async () => {
      await create();
      fill();
      submit();

      expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });

    it('vuelve a la ruta pedida originalmente (returnUrl)', async () => {
      await create({ returnUrl: '/inventory?page=2' });
      fill();
      submit();

      expect(navigateByUrl).toHaveBeenCalledWith('/inventory?page=2');
    });

    it('ignora un returnUrl que apunta a otro sitio', async () => {
      for (const returnUrl of [
        '//evil.com',
        'https://evil.com',
        'javascript:alert(1)',
        '/auth/login',
      ]) {
        TestBed.resetTestingModule();
        await create({ returnUrl });
        fill();
        submit();

        expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
      }
    });
  });

  describe('estado de carga y errores', () => {
    it('deshabilita el botón mientras ingresa y no permite enviar dos veces', async () => {
      const pending = new Subject<AuthUser>();
      auth.login.mockReturnValue(pending);
      await create();
      fill();

      submit();
      expect(button().disabled).toBe(true);
      expect(text()).toContain('Ingresando...');

      submit();
      expect(auth.login).toHaveBeenCalledTimes(1);

      pending.next(USER);
      pending.complete();
      expect(navigateByUrl).toHaveBeenCalledTimes(1);
    });

    it('con credenciales inválidas muestra un mensaje claro, conserva los datos y no navega', async () => {
      auth.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
      await create();
      fill('ana@example.com', 'mala');

      submit();

      expect(text()).toContain('Email o contraseña incorrectos.');
      expect(root().querySelector('[role=alert]')).not.toBeNull();
      expect(navigateByUrl).not.toHaveBeenCalled();
      expect(button().disabled).toBe(false);
      expect((root().querySelector('input[type=email]') as HTMLInputElement).value).toBe(
        'ana@example.com',
      );
    });

    it('un nuevo intento limpia el error anterior', async () => {
      auth.login.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));
      await create();
      fill();
      submit();
      expect(text()).toContain('Email o contraseña incorrectos.');

      submit();

      expect(text()).not.toContain('Email o contraseña incorrectos.');
      expect(navigateByUrl).toHaveBeenCalled();
    });
  });

  describe('avisos', () => {
    it('informa que la sesión expiró', async () => {
      await create({ reason: 'expired' });

      expect(text()).toContain('Tu sesión expiró');
      expect(root().querySelector('[role=status]')).not.toBeNull();
    });

    it('informa que la sesión ya no es válida', async () => {
      await create({ reason: 'unauthorized' });

      expect(text()).toContain('Tu sesión ya no es válida');
    });

    it('confirma que la cuenta fue creada', async () => {
      await create({ registered: '1' });

      expect(text()).toContain('Tu cuenta fue creada');
    });

    it('sin motivo no muestra ningún aviso', async () => {
      await create();

      expect(root().querySelector('[role=status]')).toBeNull();
    });
  });
});

describe('loginErrorMessage', () => {
  const http = (status: number, body?: unknown): HttpErrorResponse =>
    new HttpErrorResponse({ status, error: body });

  it('no revela cuál dato falló ante credenciales inválidas', () => {
    expect(loginErrorMessage(http(401))).toBe('Email o contraseña incorrectos.');
  });

  it('usa el mensaje del servidor cuando el acceso está prohibido (usuario desactivado)', () => {
    expect(loginErrorMessage(http(403, { message: 'Usuario desactivado' }))).toBe(
      'Usuario desactivado',
    );
    expect(loginErrorMessage(http(403))).toBe('Tu usuario no tiene permiso para ingresar.');
  });

  it('distingue demasiados intentos, falta de conexión y errores del servidor', () => {
    expect(loginErrorMessage(http(429))).toContain('Demasiados intentos');
    expect(loginErrorMessage(http(0))).toContain('No se pudo conectar');
    expect(loginErrorMessage(http(503))).toContain('El servidor tuvo un problema');
  });

  it('para cualquier otro error usa un mensaje genérico', () => {
    expect(loginErrorMessage(http(400))).toBe('No se pudo iniciar sesión. Intentá nuevamente.');
    expect(loginErrorMessage(new Error('respuesta rara'))).toBe(
      'No se pudo iniciar sesión. Intentá nuevamente.',
    );
  });
});

describe('loginNotice', () => {
  it('prioriza la cuenta recién creada y reconoce los motivos de cierre', () => {
    expect(loginNotice(convertToParamMap({ registered: '1', reason: 'expired' }))).toContain(
      'creada',
    );
    expect(loginNotice(convertToParamMap({ reason: 'expired' }))).toContain('expiró');
    expect(loginNotice(convertToParamMap({ reason: 'unauthorized' }))).toContain('ya no es válida');
    expect(loginNotice(convertToParamMap({ reason: 'otra-cosa' }))).toBeNull();
    expect(loginNotice(convertToParamMap({}))).toBeNull();
  });
});
