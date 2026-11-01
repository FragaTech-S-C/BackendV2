import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { TwoFactorAuthService } from './services/two-factor-auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

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
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private twoFactorAuthService: TwoFactorAuthService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) {
      return null;
    }

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
    return this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      institutionId: user.institutionId ?? undefined,
    });
    // if (!user) {
    //   throw new UnauthorizedException('Invalid credentials');
    // }

    // // Check 2FA if enabled
    // const fullUser = await this.usersService.findByEmailWithPassword(loginDto.email);
    // if (fullUser?.twoFactorEnabled) {
    //   if (!loginDto.twoFactorCode) {
    //     throw new UnauthorizedException('Two-factor authentication code required');
    //   }
    //   const isValid = this.twoFactorAuthService.verifyToken(fullUser.twoFactorSecret!, loginDto.twoFactorCode);
    //   if (!isValid) {
    //     throw new UnauthorizedException('Invalid two-factor authentication code');
    //   }
    // }

    
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