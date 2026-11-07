import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import type { Mock } from 'vitest';
import { AuthUser, UserRole } from '../../models/auth.model';
import { AuthService } from '../../services/auth.service';
import { Shell, initialsOf } from './shell';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;
  let element: HTMLElement;
  let auth: { currentUser: () => AuthUser | null; hasRole: Mock; logout: Mock };
  let navigateByUrl: Mock;

  async function create(role: UserRole, name = 'Ana Pérez'): Promise<void> {
    const user: AuthUser = { id: 'u1', email: 'ana@example.com', name, role };
    auth = {
      currentUser: () => user,
      hasRole: vi.fn((...roles: UserRole[]) => roles.includes(role)),
      logout: vi.fn(() => of(undefined)),
    };
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    navigateByUrl = vi.fn(() => Promise.resolve(true));
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(navigateByUrl as never);
    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  const labels = (): (string | undefined)[] =>
    Array.from(element.querySelectorAll('.nav__link span')).map((s) => s.textContent?.trim());
  const logoutButton = (): HTMLButtonElement =>
    element.querySelector('button[aria-label="Cerrar sesión"]') as HTMLButtonElement;

  describe('menú según el rol', () => {
    it('un administrador ve todos los módulos, incluida la analítica', async () => {
      await create('Admin');

      expect(labels()).toEqual([
        'Panel Principal',
        'Inventario & Stock',
        'Ventas & Pagos',
        'Analítica',
      ]);
    });

    it('el propietario también ve la analítica', async () => {
      await create('Owner');

      expect(labels()).toContain('Analítica');
    });

    it('un empleado ve inventario y ventas pero no la analítica', async () => {
      await create('Employee');

      expect(labels()).toEqual(['Panel Principal', 'Inventario & Stock', 'Ventas & Pagos']);
    });

    it('cada link apunta a su ruta', async () => {
      await create('Admin');

      const hrefs = Array.from(element.querySelectorAll('.nav__link')).map((a) =>
        a.getAttribute('href'),
      );
      expect(hrefs).toEqual(['/dashboard', '/inventory', '/sales', '/analytics']);
    });
  });

  describe('usuario actual', () => {
    it('muestra el nombre, el rol y las iniciales', async () => {
      await create('Admin', 'Carlos Méndez');

      expect(element.querySelector('.user__text strong')?.textContent).toBe('Carlos Méndez');
      expect(element.querySelector('.user__text .app-eyebrow')?.textContent).toBe('Administrador');
      expect(element.querySelector('.user__avatar')?.textContent?.trim()).toBe('CM');
    });

    it('muestra el email al pasar el mouse', async () => {
      await create('Employee');

      expect(element.querySelector('.user__text')?.getAttribute('title')).toBe('ana@example.com');
    });

    it('traduce cada rol a su nombre en español', async () => {
      for (const [role, label] of [
        ['Owner', 'Propietario'],
        ['Admin', 'Administrador'],
        ['Employee', 'Empleado'],
      ] as const) {
        TestBed.resetTestingModule();
        await create(role);

        expect(element.querySelector('.user__text .app-eyebrow')?.textContent).toBe(label);
      }
    });
  });

  describe('cerrar sesión', () => {
    it('cierra la sesión y vuelve al login', async () => {
      await create('Employee');

      logoutButton().click();

      expect(auth.logout).toHaveBeenCalledTimes(1);
      expect(navigateByUrl).toHaveBeenCalledWith('/auth/login');
    });

    it('mientras cierra deshabilita el botón y no permite repetirlo', async () => {
      await create('Employee');
      const pending = new Subject<void>();
      auth.logout.mockReturnValue(pending);

      logoutButton().click();
      fixture.detectChanges();

      expect(logoutButton().disabled).toBe(true);
      expect(navigateByUrl).not.toHaveBeenCalled();

      (fixture.componentInstance as unknown as { logout: () => void }).logout();
      expect(auth.logout).toHaveBeenCalledTimes(1);

      pending.complete();
      expect(navigateByUrl).toHaveBeenCalledWith('/auth/login');
    });
  });

  it('abre y cierra el menú lateral en pantallas chicas', async () => {
    await create('Admin');
    const sidebar = element.querySelector('.sidebar') as HTMLElement;
    const toggle = element.querySelector('.topbar__menu') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();
    expect(sidebar.classList.contains('sidebar--open')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    (element.querySelector('.backdrop') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(sidebar.classList.contains('sidebar--open')).toBe(false);
  });
});

describe('initialsOf', () => {
  it('toma la primera letra de hasta dos palabras, en mayúscula', () => {
    expect(initialsOf('Ana Pérez')).toBe('AP');
    expect(initialsOf('carlos')).toBe('C');
    expect(initialsOf('  maría  del  carmen ')).toBe('MD');
  });

  it('sin nombre usa una inicial genérica', () => {
    expect(initialsOf('')).toBe('U');
    expect(initialsOf('   ')).toBe('U');
  });
});
