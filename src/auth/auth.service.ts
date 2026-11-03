import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import nodemailer from "nodemailer";
import { UsersService } from '../users/users.service';
import { TwoFactorAuthService } from './services/two-factor-auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend'

export interface GoogleSignUpInput {
  email: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  avatar?: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  institutionId?: string;
}

export interface GenerateTokensInput {
  id: string;
  email: string;
  role: UserRole;
  institutionId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar: string;
    role: UserRole;
    institutionId?: string;
  };
}

@Injectable()
export class AuthService {
  private readonly passwordResetTokens = new Map<string, { id: string; email: string; expiresAt: number }>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private twoFactorAuthService: TwoFactorAuthService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return null;
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    const { password: _, twoFactorSecret, refreshToken, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto): Promise<AuthTokens> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      institutionId: user.institutionId ?? undefined,
    });    
  }

  async register(registerDto: RegisterDto): Promise<AuthTokens> {
    const user = await this.usersService.create({
      ...registerDto,
      role: registerDto.role || UserRole.NORMAL_USER,
    });

    // Auto-activate for normal users, pending for institutional
    if (user.role === UserRole.NORMAL_USER) {
      await this.usersService.changeStatus(user.id, UserStatus.ACTIVE);
    }

    return this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      institutionId: user.institutionId ?? undefined,
    });
  }

  async loginWithGoogle(profile: GoogleSignUpInput): Promise<AuthTokens> {
    const normalizedEmail = profile.email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(normalizedEmail);

    if (existingUser) {
      return this.generateTokens({
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role as UserRole,
        institutionId: existingUser.institutionId ?? undefined,
      });
    }

    const createdUser = await this.usersService.create({
      email: normalizedEmail,
      password: `google-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      firstName: profile.firstName ?? 'Google',
      lastName: profile.lastName ?? 'User',
      nickname: profile.nickname ?? normalizedEmail.split('@')[0],
      avatar: profile.avatar ?? undefined,
      role: UserRole.NORMAL_USER,
    });

    await this.usersService.changeStatus(createdUser.id, UserStatus.ACTIVE);

    return this.generateTokens({
      id: createdUser.id,
      email: createdUser.email,
      role: createdUser.role as UserRole,
      institutionId: createdUser.institutionId ?? undefined,
    });
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('jwt.secret'),
      });

      const user = await this.usersService.findByIdForAuth(payload.sub);
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens({
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        institutionId: user.institutionId ?? undefined,
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshToken(userId, null);
  }

  async resetPassword(userId: string, currentPassword: string, newPassword: string) {
    return this.usersService.resetPassword(userId, currentPassword, newPassword);
  }

  createPasswordResetToken(payload: { id: string; email: string }): string {
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: '15m',
    });

    if (token) {
      return token;
    }

    const fallbackToken = `reset_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    this.passwordResetTokens.set(fallbackToken, {
      id: payload.id,
      email: payload.email,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    return fallbackToken;
  }

  async requestPasswordReset(email: string) {
        const normalizedEmail = email.trim();
        const user = await this.usersService.findByEmail(normalizedEmail);

        if (!user) {
        throw new UnauthorizedException('No account was found for that email');
        }
        const resend = new Resend(Bun.env.RESEND_API_KEY);
        const token = this.createPasswordResetToken({ id: user.id, email: user.email });
        resend.emails.send({
            from: 'onboarding@resend.dev',
            to: user.email,
            subject: 'Password reset',
            html: `<p>This is the token wich you use to reset your password: <strong> \n  ${token}\n </strong>!</p>`
        });
   }

  async confirmPasswordReset(token: string, newPassword: string) {
    if (!token) {
      throw new UnauthorizedException('A valid reset token is required');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new UnauthorizedException('Password must be at least 8 characters long');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      }) as { id?: string; email?: string };

      if (!payload?.email) {
        throw new UnauthorizedException('Invalid reset token');
      }

      const user = await this.usersService.findByEmail(payload.email);
      if (!user) {
        throw new UnauthorizedException('No account was found for that email');
      }

      await this.usersService.update(user.id, { password: newPassword });
      return { message: 'Password updated successfully' };
    } catch (error) {
      const fallbackToken = this.passwordResetTokens.get(token);
      if (!fallbackToken || fallbackToken.expiresAt < Date.now()) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      const user = await this.usersService.findByEmail(fallbackToken.email);
      if (!user) {
        throw new UnauthorizedException('No account was found for that email');
      }

      await this.usersService.update(user.id, { password: newPassword });
      this.passwordResetTokens.delete(token);
      return { message: 'Password updated successfully' };
    }
  }

  async resetPasswordByEmail(email: string, newPassword: string, token: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('No account was found for that email');
    }

    if (!token) {
      throw new UnauthorizedException('A valid reset token is required to change the password');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new UnauthorizedException('Password must be at least 8 characters long');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      }) as { email?: string };

      if (payload?.email && payload.email.trim().toLowerCase() !== normalizedEmail) {
        throw new UnauthorizedException('Reset token does not match this account');
      }
    } catch (error) {
      const fallbackToken = this.passwordResetTokens.get(token);
      if (!fallbackToken || fallbackToken.expiresAt < Date.now() || fallbackToken.email.trim().toLowerCase() !== normalizedEmail) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }
    }

    await this.confirmPasswordReset(token, newPassword);
    return { message: 'Password updated successfully' };
  }

  async generateTokens(user: GenerateTokensInput): Promise<AuthTokens> {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    });

    await this.usersService.updateRefreshToken(user.id, refreshToken);
    await this.usersService.updateLastLogin(user.id);

    const userDetails = await this.usersService.findById(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: userDetails.id,
        email: userDetails.email,
        firstName: userDetails.firstName ?? '',
        lastName: userDetails.lastName ?? '',
        avatar: userDetails.avatar ?? '',
        role: userDetails.role as UserRole,
        institutionId: userDetails.institutionId ?? undefined,
      },
    };
  }

  async enableTwoFactor(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.usersService.findByIdForAuth(userId);
    const { secret, otpauthUrl } = this.twoFactorAuthService.generateSecret(user.email);
    const qrCode = await this.twoFactorAuthService.generateQRCode(otpauthUrl);
    return { secret, qrCode };
  }

  async confirmTwoFactor(userId: string, token: string): Promise<void> {
    const user = await this.usersService.findByIdForAuth(userId);
    if (!user.twoFactorSecret) {
      throw new UnauthorizedException('Two-factor authentication not set up');
    }

    const isValid = this.twoFactorAuthService.verifyToken(user.twoFactorSecret, token);
    if (!isValid) {
      throw new UnauthorizedException('Invalid two-factor authentication code');
    }

    await this.usersService.enableTwoFactor(userId, user.twoFactorSecret);
  }

  async disableTwoFactor(userId: string, token: string): Promise<void> {
    const user = await this.usersService.findByIdForAuth(userId);
    if (!user.twoFactorEnabled) {
      throw new UnauthorizedException('Two-factor authentication not enabled');
    }

    const isValid = this.twoFactorAuthService.verifyToken(user.twoFactorSecret!, token);
    if (!isValid) {
      throw new UnauthorizedException('Invalid two-factor authentication code');
    }

    await this.usersService.disableTwoFactor(userId);
  }
}