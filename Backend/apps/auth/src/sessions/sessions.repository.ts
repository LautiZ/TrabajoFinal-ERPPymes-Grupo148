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

  // Raw SQL so revoked_at uses the DB clock, the same one that set
  // created_at; an app clock behind the DB would violate the CHECK.
  // Idempotent: already revoked rows are not touched.
  async revoke(id: string): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE auth.sessions SET revoked_at = now()
      WHERE id = ${id}::uuid AND revoked_at IS NULL`;
  }

  // Filters by (user_id, expires_at), which matches the existing index
  async revokeAllForUser(userId: string): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE auth.sessions SET revoked_at = now()
      WHERE user_id = ${userId}::uuid
        AND revoked_at IS NULL
        AND expires_at > now()`;
  }
}
