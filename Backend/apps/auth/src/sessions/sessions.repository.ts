import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, expiresAt: Date) {
    return this.prisma.session.create({ data: { userId, expiresAt } });
  }

  // Active = not revoked, not expired, and its user is still active.
  // The role comes from users, so a role change applies on the next request.
  findActive(id: string) {
    return this.prisma.session.findFirst({
      where: {
        id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { active: true },
      },
      select: { id: true, user: { select: { id: true, role: true } } },
    });
  }

  // updateMany instead of update: no error if the session is missing or
  // already revoked, which makes logout idempotent and keeps the first
  // revocation timestamp
  revoke(id: string) {
    return this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Filters by (user_id, expires_at), which matches the existing index
  revokeAllForUser(userId: string) {
    return this.prisma.session.updateMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
  }
}
