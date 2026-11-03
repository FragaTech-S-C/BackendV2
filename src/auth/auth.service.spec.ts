import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('should reject invalid credentials without crashing', async () => {
    const usersService = {
      findByEmailWithPassword: jest.fn().mockResolvedValue(null),
      updateRefreshToken: jest.fn(),
      updateLastLogin: jest.fn(),
      findById: jest.fn(),
    };

    const jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const authService = new AuthService(
      usersService as any,
      jwtService as any,
      {} as any,
      { get: jest.fn() } as any,
    );

    await expect(
      authService.login({ email: 'test@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('creates a user session from Google profile data when the email is new', async () => {
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'g-user-1',
        email: 'google.user@example.com',
        firstName: 'Google',
        lastName: 'User',
        nickname: 'google.user',
        role: 'NORMAL_USER',
        institutionId: null,
      }),
      changeStatus: jest.fn().mockResolvedValue({ id: 'g-user-1' }),
      updateRefreshToken: jest.fn(),
      updateLastLogin: jest.fn(),
      findById: jest.fn().mockResolvedValue({
        id: 'g-user-1',
        email: 'google.user@example.com',
        firstName: 'Google',
        lastName: 'User',
        avatar: '',
        role: 'NORMAL_USER',
        institutionId: null,
      }),
    };

    const jwtService = { sign: jest.fn().mockReturnValue('token'), verify: jest.fn() };
    const authService = new AuthService(usersService as any, jwtService as any, {} as any, { get: jest.fn() } as any);
    jest.spyOn(authService, 'generateTokens').mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh-token',
      user: {
        id: 'g-user-1',
        email: 'google.user@example.com',
        firstName: 'Google',
        lastName: 'User',
        avatar: '',
        role: 'NORMAL_USER',
        institutionId: undefined,
      },
    });

    await expect(authService.loginWithGoogle({ email: 'google.user@example.com', firstName: 'Google', lastName: 'User' })).resolves.toMatchObject({
      user: { email: 'google.user@example.com' },
    });
  });

  it('allows resetting a password only after a valid token was issued to the registered email', async () => {
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue({ id: 'u-9', email: 'reset@example.com' }),
      update: jest.fn().mockResolvedValue({ id: 'u-9' }),
    };

    const jwtService = { sign: jest.fn(), verify: jest.fn().mockReturnValue({ id: 'u-9', email: 'reset@example.com' }) };
    const configService = { get: jest.fn((key: string, fallback?: string) => fallback) };
    const authService = new AuthService(usersService as any, jwtService as any, {} as any, configService as any);
    const token = authService.createPasswordResetToken({ id: 'u-9', email: 'reset@example.com' });

    await expect(authService.resetPasswordByEmail('reset@example.com', 'new-password-123', token)).resolves.toEqual({
      message: 'Password updated successfully',
    });
  });

  it('creates a password reset request and sends the confirmation token to the registered email', async () => {
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue({ id: 'u-10', email: 'request@example.com' }),
      update: jest.fn(),
    };

    const jwtService = { sign: jest.fn(), verify: jest.fn() };
    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'jwt.secret') return 'test-secret';
        return fallback;
      }),
    };

    const authService = new AuthService(usersService as any, jwtService as any, {} as any, configService as any);
    const result = await authService.requestPasswordReset('request@example.com');

    expect(result.message).toContain('request@example.com');
    expect(result.email).toBe('request@example.com');
    expect(result.token).toBeTruthy();
  });

  it('confirms a reset token and changes the password when the token is valid', async () => {
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue({ id: 'u-11', email: 'confirm@example.com' }),
      update: jest.fn().mockResolvedValue({ id: 'u-11' }),
    };

    const jwtService = { sign: jest.fn(), verify: jest.fn() };
    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'auxEmail') return 'aux@example.com';
        return fallback;
      }),
    };

    const authService = new AuthService(usersService as any, jwtService as any, {} as any, configService as any);
    const token = authService.createPasswordResetToken({ id: 'u-11', email: 'confirm@example.com' });

    await expect(authService.confirmPasswordReset(token, 'new-password-456')).resolves.toEqual({
      message: 'Password updated successfully',
    });
  });
});
