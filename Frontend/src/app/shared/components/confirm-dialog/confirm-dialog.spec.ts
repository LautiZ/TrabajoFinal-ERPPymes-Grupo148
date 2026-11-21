import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

describe('ConfirmDialog', () => {
  let close: ReturnType<typeof vi.fn>;

  async function create(data: ConfirmDialogData): Promise<HTMLElement> {
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ConfirmDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const buttons = (element: HTMLElement): HTMLButtonElement[] =>
    Array.from(element.querySelectorAll('mat-dialog-actions button'));

  it('marca el botón de confirmar como destructivo cuando se pide', async () => {
    const element = await create({ title: 'T', message: 'M', destructive: true });

    expect(buttons(element)[1].classList).toContain('confirm-dialog__confirm--danger');
  });

  it('marca el diálogo como destructivo para pintarle el borde rojo', async () => {
    const element = await create({ title: 'T', message: 'M', destructive: true });

    expect(element.classList).toContain('confirm-dialog--danger');
  });

  it('por defecto el diálogo no tiene borde rojo', async () => {
    const element = await create({ title: 'T', message: 'M' });

    expect(element.classList).not.toContain('confirm-dialog--danger');
  });

  it('por defecto el botón de confirmar no es destructivo', async () => {
    const element = await create({ title: 'T', message: 'M' });

    expect(buttons(element)[1].classList).not.toContain('confirm-dialog__confirm--danger');
  });

  it('cierra con true al confirmar y con false al cancelar', async () => {
    const element = await create({ title: 'T', message: 'M' });

    buttons(element)[1].click();
    buttons(element)[0].click();

    expect(close.mock.calls).toEqual([[true], [false]]);
  });
});
