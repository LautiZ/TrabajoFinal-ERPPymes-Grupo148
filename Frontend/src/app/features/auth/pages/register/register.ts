import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { extractErrorMessage } from '../../../../core/utils/api-error';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordPolicy,
  sameAs,
} from '../../utils/password-validators';

function notBlank(control: { value: unknown }): { required: true } | null {
  return typeof control.value === 'string' && control.value.trim() ? null : { required: true };
}

export function registerErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) {
      return extractErrorMessage(
        error,
        'No tenés permisos para crear un usuario con este rol.',
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
  return 'No se pudo crear el usuario. Intentá nuevamente.';
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
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

  protected readonly passwordMin = PASSWORD_MIN_LENGTH;
  protected readonly passwordMax = PASSWORD_MAX_LENGTH;

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // Obtener rol del usuario actual para filtrar las opciones permitidas
  private readonly currentUserRole = this.auth.role?.() ?? 'Owner';
  protected readonly availableRoles = this.getCurrentUserAllowedRoles();

  private getCurrentUserAllowedRoles(): { value: string; label: string }[] {
    if (this.currentUserRole === 'Owner') {
      return [
        { value: 'Admin', label: 'Administrador' },
        { value: 'Employee', label: 'Empleado' },
      ];
    }
    return [{ value: 'Employee', label: 'Empleado' }];
  }

  protected readonly form = this.fb.group({
    name: this.fb.control('', [notBlank, Validators.maxLength(100)]),
    surname: this.fb.control('', Validators.maxLength(100)),
    email: this.fb.control('', [Validators.required, Validators.email, Validators.maxLength(254)]),
    role: this.fb.control(this.availableRoles[0]?.value ?? 'Employee', [Validators.required]),
    password: this.fb.control('', [Validators.required, passwordPolicy]),
    confirmPassword: this.fb.control('', [Validators.required, sameAs('password')]),
  });

  constructor() {
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
    const { name, surname, email, password, role } = this.form.getRawValue();
    
    const request = {
      email: email.trim(),
      password,
      name: name.trim(),
      role,
      ...(surname.trim() ? { surname: surname.trim() } : {}),
    };

    this.auth
      .createUser(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.form.reset({ role: this.availableRoles[0]?.value ?? 'Employee' });
        },
        error: (error: unknown) => this.onError(error),
      });
  }

  private onError(error: unknown): void {
    this.submitting.set(false);
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.form.controls.email.setErrors({ duplicate: true });
      this.form.controls.email.markAsTouched();
      return;
    }
    this.errorMessage.set(registerErrorMessage(error));
  }
}