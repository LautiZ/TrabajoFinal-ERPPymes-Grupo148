import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LOGIN_PATH } from '../../auth-paths';
import { ROLE_LABELS, UserRole } from '../../models/auth.model';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  /** Roles que ven el link; sin `roles`, lo ven todos. */
  roles?: readonly UserRole[];
}

/** Iniciales para el avatar: la primera letra de hasta dos palabras del nombre. */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return letters || 'U';
}

/**
 * Estructura de la aplicación autenticada: barra lateral con los módulos permitidos para el rol,
 * barra superior con el usuario actual y el botón de cerrar sesión, y el contenido.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly navOpen = signal(false);
  protected readonly loggingOut = signal(false);

  private readonly allModules: readonly NavItem[] = [
    { label: 'Panel Principal', icon: 'dashboard', path: '/dashboard' },
    { label: 'Inventario & Stock', icon: 'inventory_2', path: '/inventory' },
    { label: 'Ventas & Pagos', icon: 'point_of_sale', path: '/sales' },
    { label: 'Analítica', icon: 'insights', path: '/analytics', roles: ['Owner', 'Admin'] },
  ];

  /** Solo los links permitidos para el rol del usuario. */
  protected readonly modules = computed(() =>
    this.allModules.filter((item) => !item.roles || this.auth.hasRole(...item.roles)),
  );

  protected readonly user = this.auth.currentUser;
  protected readonly roleLabel = computed(() => {
    const role = this.user()?.role;
    return role ? ROLE_LABELS[role] : '';
  });
  protected readonly initials = computed(() => initialsOf(this.user()?.name ?? ''));

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  /** Revoca la sesión en el servidor, limpia el estado local y vuelve al login. */
  protected logout(): void {
    if (this.loggingOut()) {
      return;
    }
    this.loggingOut.set(true);
    this.auth.logout().subscribe({
      complete: () => void this.router.navigateByUrl(LOGIN_PATH),
    });
  }
}
