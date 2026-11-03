export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  frontend: {
    url: process.env.FRONTEND_URL ?? 'http://localhost:4321',
  },
  auxEmail: process.env.AUX_EMAIL ?? 'aux@meetia.local',
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'meetia',
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/meetia?schema=public',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'meetia-super-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
//   google: {
//     clientId: process.env.GOOGLE_CLIENT_ID ?? '',
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
//     callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/auth/google/callback',
//   },
  twoFA: {
    issuer: 'Meetia',
    window: 1,
  },
  mail: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: (process.env.SMTP_SECURE ?? 'false').toLowerCase() !== 'false',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'no-reply@localhost',
    ignoreTlsErrors: (
      process.env.SMTP_IGNORE_TLS_ERRORS ??
      process.env.SMTP_IGNOTE_TLS_ERRORS ??
      (process.env.NODE_ENV !== 'production' ? 'true' : 'false')
    ).toLowerCase() === 'true',
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4321',
    credentials: true,
  },
});