import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserRole } from '../../models/auth.model';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  /** Roles que ven el link; sin `roles`, lo ven todos. */
  roles?: readonly UserRole[];
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
  private readonly auth = inject(AuthService);

  protected readonly navOpen = signal(false);

  private readonly allModules: readonly NavItem[] = [
    { label: 'Panel Principal', icon: 'dashboard', path: '/dashboard' },
    { label: 'Inventario & Stock', icon: 'inventory_2', path: '/inventory' },
    { label: 'Ventas & Pagos', icon: 'point_of_sale', path: '/sales' },
    { label: 'Analítica', icon: 'insights', path: '/analytics', roles: ['Owner', 'Admin'] },
  ];

  protected readonly modules: readonly NavItem[] = this.allModules.filter(
    (item) => !item.roles || this.auth.hasRole(...item.roles),
  );

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }
}
