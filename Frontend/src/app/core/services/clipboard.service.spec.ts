import { TestBed } from '@angular/core/testing';
import { ClipboardService } from './clipboard.service';

describe('ClipboardService', () => {
  let service: ClipboardService;

  beforeEach(() => {
    service = TestBed.inject(ClipboardService);
  });

  /** El entorno de test puede no traer `navigator.clipboard`: se define a mano. */
  function setClipboard(value: unknown): void {
    Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
  }

  afterEach(() => {
    delete (navigator as unknown as { clipboard?: unknown }).clipboard;
  });

  it('usa la API del portapapeles cuando está disponible', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });

    expect(await service.copy('https://pago.test/abc')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://pago.test/abc');
  });

  it('si la API falla, usa el respaldo con selección de texto', async () => {
    setClipboard({ writeText: () => Promise.reject(new Error('denied')) });
    const exec = vi.fn(() => true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;

    expect(await service.copy('hola')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('informa false si no se pudo copiar por ningún medio', async () => {
    setClipboard(undefined);
    (document as unknown as { execCommand: unknown }).execCommand = vi.fn(() => false);

    expect(await service.copy('hola')).toBe(false);
  });
});
