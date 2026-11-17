import { IsJWT, MaxLength } from 'class-validator';

export class ValidateTokenDto {
  // Cheap format check before spending a DB query on garbage
  @IsJWT()
  @MaxLength(4096)
  token!: string;
}
