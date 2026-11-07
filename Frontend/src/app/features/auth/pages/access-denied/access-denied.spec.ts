import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccessDenied } from './access-denied';

describe('AccessDenied', () => {
  it('informa el acceso denegado y ofrece volver al panel', async () => {
    await TestBed.configureTestingModule({
      imports: [AccessDenied],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(AccessDenied);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Acceso denegado');
    expect(element.textContent).toContain('No tenés permisos');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/dashboard');
  });
});
