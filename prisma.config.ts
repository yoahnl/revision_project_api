import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: resolvePrismaDatabaseUrl(process.env),
  },
});

function resolvePrismaDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return databaseUrl;
  }

  const isLocalLike =
    !env.NODE_ENV || env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

  if (!isLocalLike) {
    throw new Error(
      'DATABASE_URL is required outside local and test environments',
    );
  }

  return 'postgresql://revision:revision@localhost:5432/revision?schema=public';
}
