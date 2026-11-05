import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

/** Estructura de la aplicación autenticada: barra lateral, barra superior y contenido. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly navOpen = signal(false);

  protected readonly modules: readonly NavItem[] = [
    { label: 'Panel Principal', icon: 'dashboard', path: '/dashboard' },
    { label: 'Inventario & Stock', icon: 'inventory_2', path: '/inventory' },
    { label: 'Ventas & Pagos', icon: 'point_of_sale', path: '/sales' },
  ];

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }
}
