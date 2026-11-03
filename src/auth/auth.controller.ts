import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { type Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Res() resp: Response
) {
    try {
        const res = await this.authService.login(loginDto);
        return resp.status(HttpStatus.OK).send(res);
    } catch (error) {
        if (error instanceof UnauthorizedException) {
          return resp.status(HttpStatus.UNAUTHORIZED).send({ message: error.message });
        }
        return resp.status(HttpStatus.BAD_REQUEST).send({ message: error instanceof Error ? error.message : 'Login failed' });
    }
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@CurrentUser() user: any) {
    return this.authService.generateTokens(user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@CurrentUser('id') userId: string) {
    await this.authService.logout(userId);
    return { message: 'Logged out successfully' };
  }

  @Post('reset-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset the authenticated user password' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  async resetPassword(@CurrentUser() user: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.authService.resetPassword(user.id, body.currentPassword, body.newPassword);
  }

  @Post('password/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset confirmation sent to the aux email inbox' })
  @ApiResponse({ status: 200, description: 'Reset request accepted' })
  async requestPasswordReset(@Body() body: { email: string }) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('password/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a password reset token and set a new password' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  async confirmPasswordReset(@Body() body: { token: string; newPassword: string }) {
    return this.authService.confirmPasswordReset(body.token, body.newPassword);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset a user password using the token sent to the registered email' })
  @ApiResponse({ status: 200, description: 'Password reset accepted' })
  async resetPasswordByEmail(@Body() body: { email: string; newPassword: string; token: string }) {
    return this.authService.resetPasswordByEmail(body.email, body.newPassword, body.token);
  }

//   @Get('google')
//   @UseGuards(AuthGuard('google'))
//   @ApiOperation({ summary: 'Start Google OAuth login' })
//   async googleAuth() {
//     return;
//   }

//   @Get('google/callback')
//   @UseGuards(AuthGuard('google'))
//   async googleAuthCallback(@Request() req: any, @Res() res: Response) {
//     const googleProfile = req.user ?? {};
//     const tokens = await this.authService.loginWithGoogle({
//       email: googleProfile.email,
//       firstName: googleProfile.firstName,
//       lastName: googleProfile.lastName,
//       nickname: googleProfile.nickname,
//       avatar: googleProfile.avatar,
//     });

//     const frontendUrl = this.configService.get<string>('frontend.url') ?? 'http://localhost:4321';
//     const redirectUrl = new URL(`${frontendUrl.replace(/\/+$/, '')}/auth/google/callback`);
//     redirectUrl.searchParams.set('accessToken', tokens.accessToken);
//     redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);

//     return res.redirect(redirectUrl.toString());
//   }

//   @Post('google')
//   @HttpCode(HttpStatus.OK)
//   @ApiOperation({ summary: 'Create a user or sign in with Google profile data' })
//   @ApiResponse({ status: 200, description: 'Google login successful' })
//   async loginWithGoogle(@Body() body: { email: string; firstName?: string; lastName?: string; nickname?: string; avatar?: string }) {
//     return this.authService.loginWithGoogle(body);
//   }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable 2FA - returns secret and QR code' })
  @ApiResponse({ status: 200, description: '2FA secret and QR code generated' })
  async enableTwoFactor(@CurrentUser('id') userId: string) {
    return this.authService.enableTwoFactor(userId);
  }

  @Post('2fa/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm 2FA setup with token' })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async confirmTwoFactor(@CurrentUser('id') userId: string, @Body('token') token: string) {
    await this.authService.confirmTwoFactor(userId, token);
    return { message: 'Two-factor authentication enabled' };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async disableTwoFactor(@CurrentUser('id') userId: string, @Body('token') token: string) {
    await this.authService.disableTwoFactor(userId, token);
    return { message: 'Two-factor authentication disabled' };
  }
}