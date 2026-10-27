import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from './users/users.repository';

describe('AuthController', () => {
  let authController: AuthController;
  let usersRepository: UsersRepository;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: { count: jest.fn() } },
      ],
    }).compile();

    authController = app.get<AuthController>(AuthController);
    usersRepository = app.get<UsersRepository>(UsersRepository);
  });

  describe('countUsers', () => {
    it('should return the count of users', async () => {
      jest.spyOn(usersRepository, 'count').mockResolvedValue(5);
      expect(await authController.countUsers()).toBe(5);
    });
  });
});
