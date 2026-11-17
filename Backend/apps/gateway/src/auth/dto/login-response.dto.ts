import { ApiProperty } from '@nestjs/swagger';
import { ROLES, type Role } from '@app/contracts';

// HTTP response shapes only: documented for Swagger, not validated
export class UserResponseDto {
  /** @example 3f1c2a9e-8b4d-4e2f-9a1b-2c3d4e5f6a7b */
  id!: string;
  /** @example owner@erp.com */
  email!: string;
  name!: string;
  surname!: string | null;
  @ApiProperty({ enum: ROLES })
  role!: Role;
}

export class LoginResponseDto {
  /** JWT to send as `Authorization: Bearer <token>` */
  accessToken!: string;
  user!: UserResponseDto;
}
