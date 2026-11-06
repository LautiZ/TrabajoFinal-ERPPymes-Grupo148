import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { getCurrentUserRole } from '../../guards/auth.guard';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  roles?: readonly string[];
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

  private readonly allModules: readonly NavItem[] = [
    { label: 'Panel Principal', icon: 'dashboard', path: '/dashboard' },
    { label: 'Inventario & Stock', icon: 'inventory_2', path: '/inventory' },
    { label: 'Ventas & Pagos', icon: 'point_of_sale', path: '/sales' },
    { label: 'Analítica', icon: 'insights', path: '/analytics', roles: ['ADMIN'] },
  ];

  protected readonly modules: readonly NavItem[] = this.allModules.filter(
    (item) => !item.roles || item.roles.includes(getCurrentUserRole())
  );

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }
}