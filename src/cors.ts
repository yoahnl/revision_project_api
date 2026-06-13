import type { INestApplication } from '@nestjs/common';
import type {
  CorsOptions,
  CustomOrigin,
} from '@nestjs/common/interfaces/external/cors-options.interface';

type CorsEnvironment = {
  CORS_ORIGINS?: string;
};

const defaultAllowedOrigins = ['https://revision.yoahn.me'];
const localOriginPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

export function configureCors(
  app: INestApplication,
  env: CorsEnvironment = process.env,
) {
  const allowedOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  const origin: CustomOrigin = (requestOrigin, callback) => {
    callback(null, isOriginAllowed(requestOrigin, allowedOrigins));
  };

  const corsOptions: CorsOptions = {
    origin,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  };

  app.enableCors(corsOptions);
}

function parseCorsOrigins(rawOrigins?: string) {
  const configuredOrigins =
    rawOrigins
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  return new Set(
    configuredOrigins.length > 0 ? configuredOrigins : defaultAllowedOrigins,
  );
}

function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: Set<string>,
) {
  return (
    origin === undefined ||
    allowedOrigins.has(origin) ||
    localOriginPattern.test(origin)
  );
}
