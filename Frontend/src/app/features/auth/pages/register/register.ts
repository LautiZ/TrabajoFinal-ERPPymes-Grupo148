import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { LOGIN_PATH } from '../../../../core/auth-paths';
import { RegisterRequest } from '../../../../core/models/auth.model';
import { AuthService } from '../../../../core/services/auth.service';
import { extractErrorMessage } from '../../../../core/utils/api-error';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordPolicy,
  sameAs,
} from '../../utils/password-validators';

/** Rechaza valores vacíos o con solo espacios. */
function notBlank(control: { value: unknown }): { required: true } | null {
  return typeof control.value === 'string' && control.value.trim() ? null : { required: true };
}

/** Mensaje para errores del registro que no son un email repetido (ese va en el campo). */
export function registerErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) {
      return extractErrorMessage(
        error,
        'El registro público está deshabilitado: ya existe un propietario. Pedile a un administrador que cree tu cuenta.',
      );
    }
    if (error.status === 400 || error.status === 422) {
      return extractErrorMessage(error, 'Revisá los datos ingresados.');
    }
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Revisá tu conexión.';
    }
    if (error.status >= 500) {
      return 'El servidor tuvo un problema. Intentá de nuevo en unos minutos.';
    }
  }
  return 'No se pudo crear la cuenta. Intentá nuevamente.';
}

/**
 * Registro público de arranque: crea la cuenta del propietario mientras no exista uno (RN-16.4).
 * Una vez que existe, el servidor lo rechaza y se muestra su mensaje.
 */
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
  selector: 'app-register',
  styleUrl: './register.scss',
  templateUrl: './register.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loginPath = LOGIN_PATH;
  protected readonly passwordMin = PASSWORD_MIN_LENGTH;
  protected readonly passwordMax = PASSWORD_MAX_LENGTH;

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.group({
    name: this.fb.control('', [notBlank, Validators.maxLength(100)]),
    surname: this.fb.control('', Validators.maxLength(100)),
    email: this.fb.control('', [Validators.required, Validators.email, Validators.maxLength(254)]),
    password: this.fb.control('', [Validators.required, passwordPolicy]),
    confirmPassword: this.fb.control('', [Validators.required, sameAs('password')]),
  });

  constructor() {
    // La confirmación depende de la contraseña: hay que revalidarla cuando esta cambia.
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity());
  }

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
    const { name, surname, email, password } = this.form.getRawValue();
    const request: RegisterRequest = {
      email: email.trim(),
      password,
      name: name.trim(),
      ...(surname.trim() ? { surname: surname.trim() } : {}),
    };

    this.auth
      .register(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // Tras registrarse se lleva al login (no se inicia sesión sola): decisión de equipo pendiente de confirmar.
        next: () => void this.router.navigate([LOGIN_PATH], { queryParams: { registered: '1' } }),
        error: (error: unknown) => this.onError(error),
      });
  }

  private onError(error: unknown): void {
    this.submitting.set(false);
    if (error instanceof HttpErrorResponse && error.status === 409) {
      // El email ya existe: se marca en el campo; el error se limpia cuando el usuario lo edita.
      this.form.controls.email.setErrors({ duplicate: true });
      this.form.controls.email.markAsTouched();
      return;
    }
    this.errorMessage.set(registerErrorMessage(error));
  }
}
