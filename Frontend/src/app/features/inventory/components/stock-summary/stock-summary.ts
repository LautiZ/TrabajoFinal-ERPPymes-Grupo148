import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { catchError, of, switchMap, tap } from 'rxjs';
import { NotificationService } from '../../../../shared/services/notification.service';
import { StockStatusFilter } from '../../models/product.model';
import { LowStockThresholdService } from '../../services/low-stock-threshold.service';
import { StockCounts, StockSummaryService } from '../../services/stock-summary.service';

/**
 * Cabecera del inventario: cuántos productos hay en cada estado de stock, atajos para filtrar
 * por "stock bajo" / "sin stock" y el umbral configurable de "stock bajo".
 */
@Component({
  selector: 'app-stock-summary',
  imports: [MatIconModule],
  templateUrl: './stock-summary.html',
  styleUrl: './stock-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockSummary {
  private readonly summaryService = inject(StockSummaryService);
  private readonly thresholdService = inject(LowStockThresholdService);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  /** Cambia para pedir que el resumen se vuelva a consultar (p. ej. tras editar stock). */
  readonly refreshToken = input(0);
  /** Filtro de stock activo en la tabla, para marcar el atajo correspondiente. */
  readonly activeFilter = input<StockStatusFilter | ''>('');
  /** Se emite al elegir un atajo; `''` limpia el filtro. */
  readonly filterChange = output<StockStatusFilter | ''>();
  /** Se emite cuando el usuario cambia el umbral de "stock bajo". */
  readonly thresholdChange = output<number>();

  protected readonly threshold = this.thresholdService.value;
  protected readonly summary = signal<StockCounts | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  constructor() {
    toObservable(this.refreshToken)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(false);
        }),
        switchMap(() =>
          this.summaryService.load(this.thresholdService.value()).pipe(
            catchError(() => {
              this.error.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      });
  }

  /** Marcar el atajo ya activo lo desactiva. */
  protected toggle(filter: StockStatusFilter): void {
    this.filterChange.emit(this.activeFilter() === filter ? '' : filter);
  }

  protected applyThreshold(input: HTMLInputElement): void {
    const value = Number(input.value);
    if (input.value.trim() === '' || !this.thresholdService.set(value)) {
      input.value = String(this.thresholdService.value());
      this.notify.error('Ingresá un umbral válido: un número mayor o igual a 0.');
      return;
    }
    this.thresholdChange.emit(this.thresholdService.value());
  }
}
