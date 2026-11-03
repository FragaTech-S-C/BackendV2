import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptionsWithRequest, VerifyCallback, StrategyOptions } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    const clientID = configService.get<string>('google.clientId') ?? '';
    const clientSecret = configService.get<string>('google.clientSecret') ?? '';
    const callbackURL = configService.get<string>('google.callbackUrl') ?? 'http://localhost:3000/api/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: false,
    } as StrategyOptions);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile?.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google account email is required.'), undefined);
      return;
    }

    const user = {
      email,
      firstName: profile?.name?.givenName ?? 'Google',
      lastName: profile?.name?.familyName ?? 'User',
      nickname: profile?.displayName ?? email.split('@')[0],
      avatar: profile?.photos?.[0]?.value ?? undefined,
      accessToken,
      refreshToken,
    };

    done(null, user);
  }
}
