import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  // Emails are stored lowercase; normalize so "Ana@Mail.com" still matches
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  // argon2 hashes any length; cap it so a huge payload cannot burn CPU
  @MaxLength(128)
  password!: string;
}
