import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, expiresAt: Date) {
    return this.prisma.session.create({ data: { userId, expiresAt } });
  }
}
