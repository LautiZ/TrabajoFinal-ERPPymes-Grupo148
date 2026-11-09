import { IsUUID } from 'class-validator';

export class LogoutDto {
  // The Gateway gets the jti from the already validated token (request.user)
  @IsUUID()
  jti!: string;
}
