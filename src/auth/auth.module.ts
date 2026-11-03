import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TwoFactorAuthService } from './services/two-factor-auth.service';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { StringValue } from 'ms';
import { LocalStrategy } from './strategies/local.strategy';
// import { GoogleStrategy } from './strategies/google.strategy';
@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<StringValue>('JWT_EXPIRES_IN', '24h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TwoFactorAuthService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    // GoogleStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
