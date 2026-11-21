import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Copia texto al portapapeles del navegador. */
@Injectable({
  providedIn: 'root',
})
export class ClipboardService {
  private readonly document = inject(DOCUMENT);

  /** `true` si se pudo copiar. Usa la API moderna y, si no está disponible, un respaldo. */
  async copy(text: string): Promise<boolean> {
    try {
      const clipboard = this.document.defaultView?.navigator?.clipboard;
      if (clipboard?.writeText) {
        await clipboard.writeText(text);
        return true;
      }
    } catch {
      // Sin permiso o contexto no seguro: se prueba el respaldo.
    }
    return this.copyWithSelection(text);
  }

  private copyWithSelection(text: string): boolean {
    const doc = this.document;
    const field = doc.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    doc.body.appendChild(field);
    try {
      field.select();
      return doc.execCommand('copy');
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}
