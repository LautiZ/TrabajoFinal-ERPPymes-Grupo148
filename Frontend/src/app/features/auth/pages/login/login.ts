import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { REGISTER_PATH } from '../../../../core/auth-paths';
import { AuthService } from '../../../../core/services/auth.service';
import { extractErrorMessage } from '../../../../core/utils/api-error';
import { safeReturnUrl } from '../../../../core/utils/return-url';

/** Aviso informativo según por qué se llegó al login (parámetros `reason` y `registered`). */
export function loginNotice(params: ParamMap): string | null {
  if (params.get('registered')) {
    return 'Tu cuenta fue creada. Ingresá con tu email y contraseña.';
  }
  switch (params.get('reason')) {
    case 'expired':
      return 'Tu sesión expiró. Ingresá de nuevo para continuar.';
    case 'unauthorized':
      return 'Tu sesión ya no es válida. Ingresá de nuevo.';
    default:
      return null;
  }
}

/**
 * Mensaje para el usuario según el error del login. Ante credenciales inválidas no se indica
 * cuál de los dos datos falló (RF-02).
 */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) {
      return 'Email o contraseña incorrectos.';
    }
    if (error.status === 403) {
      return extractErrorMessage(error, 'Tu usuario no tiene permiso para ingresar.');
    }
    if (error.status === 429) {
      return 'Demasiados intentos. Esperá un momento e intentá de nuevo.';
    }
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Revisá tu conexión.';
    }
    if (error.status >= 500) {
      return 'El servidor tuvo un problema. Intentá de nuevo en unos minutos.';
    }
  }
  return 'No se pudo iniciar sesión. Intentá nuevamente.';
}

@Component({
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  protected readonly registerPath = REGISTER_PATH;
  protected readonly notice = loginNotice(this.route.snapshot.queryParamMap);
  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email]),
    password: this.fb.control('', Validators.required),
  });

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();

    this.auth.login({ email: email.trim(), password }).subscribe({
      // `returnUrl` se valida: solo se vuelve a rutas internas de la aplicación.
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl)),
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(loginErrorMessage(error));
      },
    });
  }
}
