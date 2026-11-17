FROM oven/bun:1-alpine
WORKDIR /app

COPY package*.json ./
COPY bun.lock ./

RUN bun install
RUN apk add --no-cache openssl libc6-compat

COPY . .
RUN DATABASE_URL="postgresql://neondb_owner:npg_QFKiVqISDk27@ep-patient-violet-aq7cfhuz.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"  bunx prisma generate

CMD ["bun", "run", "start"]