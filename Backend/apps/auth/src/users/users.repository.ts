import { Injectable } from '@nestjs/common';
import type { CreatableRole, UserSummaryView } from '@app/contracts';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Everything a caller may see: the password hash is never selected
const PUBLIC_USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  surname: true,
  role: true,
  active: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  count(): Promise<number> {
    return this.prisma.user.count();
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // Inactive users are included: a receipt still names who made the sale
  findSummary(id: string): Promise<UserSummaryView | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, surname: true },
    });
  }

  // Returns null when the email is taken. The UNIQUE index decides atomically,
  // so two concurrent requests cannot both pass a "does it exist?" check.
  async create(data: {
    email: string;
    passwordHash: string;
    name: string;
    surname?: string;
    role: CreatableRole;
  }) {
    try {
      return await this.prisma.user.create({
        data,
        select: PUBLIC_USER_FIELDS,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return null;
      }
      throw err;
    }
  }
}
