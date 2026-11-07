import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StockStatus } from '../../utils/stock-status';
import { StockBadge } from './stock-badge';

describe('StockBadge', () => {
  let fixture: ComponentFixture<StockBadge>;

  function render(status: StockStatus): HTMLElement {
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('.badge') as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StockBadge] }).compileComponents();
    fixture = TestBed.createComponent(StockBadge);
  });

  it('indica el estado con texto, no solo con color', () => {
    expect(render('ok').textContent).toContain('Stock normal');
    expect(render('low').textContent).toContain('Stock bajo');
    expect(render('out').textContent).toContain('Sin stock');
  });

  it('aplica una clase distinta por estado para colorearlo', () => {
    expect(render('ok').classList).toContain('badge--ok');
    expect(render('low').classList).toContain('badge--low');
    expect(render('out').classList).toContain('badge--out');
  });

  it('el ícono es decorativo (oculto para lectores de pantalla)', () => {
    const icon = render('low').querySelector('mat-icon');

    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});
