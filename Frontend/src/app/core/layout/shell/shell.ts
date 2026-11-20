import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { LOGIN_PATH } from '../../auth-paths';
import { Product } from '../../../features/inventory/models/product.model';
import { InventoryService } from '../../../features/inventory/services/inventory.service';
import { ROLE_LABELS, UserRole } from '../../models/auth.model';
import { canCreateUsers } from '../../utils/user-creation';
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
 * barra superior con búsqueda global, usuario actual y cerrar sesión, y el contenido.
 */
@Component({
  selector: 'app-shell',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly inventory = inject(InventoryService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostRef = inject(ElementRef<HTMLElement>);

  protected readonly navOpen = signal(false);
  protected readonly loggingOut = signal(false);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly results = signal<Product[]>([]);
  protected readonly searching = signal(false);
  protected readonly searchError = signal(false);
  protected readonly dropdownOpen = signal(false);
  protected readonly currentQuery = signal('');

  private readonly allModules: readonly NavItem[] = [
    {
      label: 'Panel Principal',
      icon: 'dashboard',
      path: '/dashboard',
      roles: ['Owner', 'Admin'],
    },
    { label: 'Inventario & Stock', icon: 'inventory_2', path: '/inventory' },
    { label: 'Ventas & Pagos', icon: 'point_of_sale', path: '/sales' },
    { label: 'Analítica', icon: 'insights', path: '/analytics', roles: ['Owner', 'Admin'] },
  ];

  /** Solo los links permitidos para el rol del usuario. */
  protected readonly modules = computed(() =>
    this.allModules.filter((item) => !item.roles || this.auth.hasRole(...item.roles)),
  );

  protected readonly user = this.auth.currentUser;
  /** El botón "Crear usuario" solo lo ven el Owner y los Admin. */
  protected readonly canCreateUsers = computed(() => canCreateUsers(this.user()?.role));
  protected readonly roleLabel = computed(() => {
    const role = this.user()?.role;
    return role ? ROLE_LABELS[role] : '';
  });
  protected readonly initials = computed(() => initialsOf(this.user()?.name ?? ''));

  constructor() {
    this.searchControl.valueChanges
      .pipe(
        map((value) => value.trim()),
        tap((term) => {
          this.currentQuery.set(term);
          this.searchError.set(false);
          if (term.length < 2) {
            this.results.set([]);
            this.searching.set(false);
            this.dropdownOpen.set(false);
          }
        }),
        debounceTime(250),
        distinctUntilChanged(),
        filter((term) => term.length >= 2),
        tap(() => {
          this.searching.set(true);
          this.dropdownOpen.set(true);
        }),
        switchMap((term) =>
          this.inventory.list({ search: term, limit: 6, page: 1 }).pipe(
            catchError(() => {
              this.searchError.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.searching.set(false);
        this.results.set(response ? response.data : []);
      });
  }

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  protected openIfHasQuery(): void {
    if (this.currentQuery().length >= 2) {
      this.dropdownOpen.set(true);
    }
  }

  protected closeResults(): void {
    this.dropdownOpen.set(false);
  }

  protected clearSearch(): void {
    this.searchControl.setValue('');
    this.results.set([]);
    this.dropdownOpen.set(false);
  }

  protected selectProduct(product: Product): void {
    this.dropdownOpen.set(false);
    void this.router.navigate(['/inventory'], {
      queryParams: { search: product.sku },
    });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.hostRef.nativeElement.contains(event.target as Node)) {
      this.dropdownOpen.set(false);
    }
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
