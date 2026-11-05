import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Shell } from './shell';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('muestra los módulos de navegación', () => {
    const labels = Array.from(element.querySelectorAll('.nav__link span')).map((s) =>
      s.textContent?.trim(),
    );

    expect(labels).toEqual(['Panel Principal', 'Inventario & Stock', 'Ventas & Pagos']);
  });

  it('abre y cierra el menú lateral en pantallas chicas', () => {
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
