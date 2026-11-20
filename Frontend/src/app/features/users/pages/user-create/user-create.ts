import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { ROLE_LABELS, UserRole } from '../../../../core/models/auth.model';
import { AuthService } from '../../../../core/services/auth.service';
import { extractErrorMessage, isConflict } from '../../../../core/utils/api-error';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { NotificationService } from '../../../../shared/services/notification.service';

/** El nombre no puede ser solo espacios (el backend recorta y exige al menos 1 carácter). */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { required: true };
}

/** Email válido ignorando espacios al borde (se recortan al enviar), p. ej. al pegarlo. */
function trimmedEmail(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  return value ? Validators.email({ value } as AbstractControl) : null;
}

/**
 * Alta de usuarios (`/users/new`). Solo la ven el `Owner` (crea `Admin` o `Employee`) y los
 * `Admin` (solo `Employee`), según RN-16. La ruta además exige esos roles, y el servidor vuelve
 * a validar la matriz de roles en cada request.
 */
@Component({
  selector: 'app-user-create',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    PageHeader,
  ],
  templateUrl: './user-create.html',
  styleUrl: './user-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserCreate {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notify = inject(NotificationService);

  protected readonly roleLabels = ROLE_LABELS;
  /** Roles que el usuario actual puede asignar. */
  protected readonly roles = this.auth.creatableRoles;
  /** Con un único rol posible (el Admin crea Employee) no hay nada que elegir. */
  protected readonly singleRole = computed(() => this.roles().length === 1);
  protected readonly saving = signal(false);
  protected readonly showPassword = signal(false);
  private readonly formDirective = viewChild(FormGroupDirective);

  protected readonly form = this.fb.group({
    name: this.fb.control('', [notBlank, Validators.maxLength(100)]),
    surname: this.fb.control('', Validators.maxLength(100)),
    email: this.fb.control('', [Validators.required, trimmedEmail]),
    password: this.fb.control('', [
      Validators.required,
      Validators.minLength(8),
      Validators.maxLength(128),
    ]),
    role: this.fb.control<UserRole | ''>(this.defaultRole(), Validators.required),
  });

  constructor() {
    // Con un único rol posible no hay nada que elegir: queda fijo (getRawValue lo sigue incluyendo).
    if (this.singleRole()) {
      this.form.controls.role.disable();
    }
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    const role = this.form.controls.role.value;
    // Defensa en profundidad: el servidor igual rechaza (403) un rol que no corresponde.
    if (!role || !this.roles().includes(role)) {
      this.notify.error('Tu rol no puede crear este tipo de usuario.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const surname = value.surname.trim();
    this.saving.set(true);
    this.auth
      .createUser({
        email: value.email.trim().toLowerCase(),
        password: value.password,
        name: value.name.trim(),
        ...(surname ? { surname } : {}),
        role,
      })
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.notify.success(`Usuario ${created.email} creado como ${ROLE_LABELS[created.role]}.`);
          this.resetForm();
        },
        error: (error: unknown) => this.onError(error),
      });
  }

  private resetForm(): void {
    const empty = { name: '', surname: '', email: '', password: '', role: this.defaultRole() };
    // resetForm también limpia el estado "enviado" que, si no, deja los errores de "obligatorio".
    const directive = this.formDirective();
    if (directive) {
      directive.resetForm(empty);
    } else {
      this.form.reset(empty);
    }
    this.showPassword.set(false);
  }

  private defaultRole(): UserRole | '' {
    // Para el Owner el primer rol es "Admin": es para lo que existe esta pantalla.
    return this.auth.creatableRoles()[0] ?? '';
  }

  private onError(error: unknown): void {
    this.saving.set(false);
    if (isConflict(error)) {
      this.form.controls.email.setErrors({ duplicate: true });
      this.form.controls.email.markAsTouched();
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 403) {
      this.notify.error('Tu rol no puede crear este tipo de usuario.');
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 0) {
      this.notify.error('No se pudo conectar con el servidor. Revisá tu conexión.');
      return;
    }
    this.notify.error(extractErrorMessage(error, 'No se pudo crear el usuario.'));
  }
}
