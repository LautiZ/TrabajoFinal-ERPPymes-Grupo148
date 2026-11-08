import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { envs } from './config/envs';
import { PrismaModule } from './prisma/prisma.module';
import { UsersRepository } from './users/users.repository';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: envs.JWT_SECRET,
      // exp is set in the payload from the session, so no expiresIn here
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersRepository],
})
export class AuthModule {}
