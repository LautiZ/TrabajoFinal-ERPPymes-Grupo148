import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ROLES, type Role } from '../roles';

// Owner is never created through the API: it only comes from the seed
export const CREATABLE_ROLES = [
  'Admin',
  'Employee',
] as const satisfies readonly Role[];
export type CreatableRole = (typeof CREATABLE_ROLES)[number];

export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  surname?: string;

  @IsIn(CREATABLE_ROLES)
  role!: CreatableRole;
}

// TCP payload: the gateway fills actorRole from the validated session, never from the client
export class CreateUserMessage {
  @IsIn(ROLES)
  actorRole!: Role;

  @ValidateNested()
  @Type(() => CreateUserDto)
  user!: CreateUserDto;
}
