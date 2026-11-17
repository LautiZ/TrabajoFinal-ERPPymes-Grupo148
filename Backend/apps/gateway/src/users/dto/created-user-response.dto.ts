import { UserResponseDto } from '../../auth/dto/login-response.dto';

export class CreatedUserResponseDto extends UserResponseDto {
  active!: boolean;
  createdAt!: Date;
}
