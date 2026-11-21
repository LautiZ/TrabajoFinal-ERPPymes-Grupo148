import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { UNIT_LABELS } from '../../../sales/models/product.model';
import { PurchaseSnapshotService } from '../../../sales/services/purchase-snapshot.service';

type Outcome = 'success' | 'pending' | 'failure' | 'unknown';

interface View {
  icon: string;
  title: string;
  message: string;
  tone: 'ok' | 'wait' | 'error';
}

const VIEWS: Record<Outcome, View> = {
  success: {
    icon: 'check_circle',
    title: '¡Gracias por su compra!',
    message: 'Mercado Pago nos informó que su pago fue aprobado. ¡Que lo disfrute!',
    tone: 'ok',
  },
  pending: {
    icon: 'schedule',
    title: 'Estamos esperando su pago',
    message:
      'Mercado Pago todavía no confirmó el pago. Puede demorar unos minutos; el comercio lo verá reflejado apenas se acredite.',
    tone: 'wait',
  },
  failure: {
    icon: 'error',
    title: 'No pudimos procesar su pago',
    message:
      'No se realizó ningún cobro. Puede volver a intentarlo con el mismo link o consultar en el comercio.',
    tone: 'error',
  },
  unknown: {
    icon: 'favorite',
    title: '¡Gracias por su visita!',
    message: 'Si tiene dudas sobre su compra, consulte en el comercio.',
    tone: 'ok',
  },
};

function outcomeOf(value: string | null): Outcome {
  return value === 'success' || value === 'pending' || value === 'failure' ? value : 'unknown';
}

/**
 * Pantalla **pública** (sin sesión) a la que Mercado Pago devuelve al comprador. Es solo
 * informativa: no consulta el backend ni cambia nada; el estado real del pago lo confirma el
 * webhook y lo ve el comercio. El detalle de la compra aparece solo si este navegador lo guardó
 * al generar el pago (no hay un endpoint público para consultar una venta).
 */
@Component({
  selector: 'app-thank-you',
  imports: [CurrencyPipe, MatIconModule],
  templateUrl: './thank-you.html',
  styleUrl: './thank-you.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThankYou {
  private readonly route = inject(ActivatedRoute);
  private readonly purchases = inject(PurchaseSnapshotService);

  // Reactivos: si solo cambia el parámetro de la ruta, el componente se reutiliza.
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  private readonly outcome = computed(() => outcomeOf(this.params().get('result')));
  protected readonly view = computed(() => VIEWS[this.outcome()]);
  protected readonly celebrate = computed(() => this.outcome() === 'success');
  protected readonly unitSymbols = UNIT_LABELS;

  protected readonly purchase = computed(() =>
    this.outcome() === 'failure'
      ? null
      : this.purchases.find(this.query().get('external_reference')),
  );
  /** Posiciones de los confeti (solo decoración; el estilo de cada uno lo define el CSS). */
  protected readonly confetti = Array.from({ length: 24 }, (_, i) => i);
}
