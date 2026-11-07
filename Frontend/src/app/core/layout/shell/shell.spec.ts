import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UserRole } from '../../models/auth.model';
import { AuthService } from '../../services/auth.service';
import { Shell } from './shell';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;
  let element: HTMLElement;

  async function create(role: UserRole): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { hasRole: (...roles: UserRole[]) => roles.includes(role) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  const labels = (): (string | undefined)[] =>
    Array.from(element.querySelectorAll('.nav__link span')).map((s) => s.textContent?.trim());

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

  it('un empleado no ve el link de analítica', async () => {
    await create('Employee');

    expect(labels()).toEqual(['Panel Principal', 'Inventario & Stock', 'Ventas & Pagos']);
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
