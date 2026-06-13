export const localDatabaseUrl =
  'postgresql://revision:revision@localhost:5432/revision?schema=public';

type DatabaseUrlEnv = {
  DATABASE_URL?: string;
  NODE_ENV?: string;
};

const localNodeEnvironments = new Set(['development', 'local', 'test']);

export function resolvePrismaDatabaseUrl(
  env: DatabaseUrlEnv = process.env,
): string {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return databaseUrl;
  }

  if (!env.NODE_ENV || localNodeEnvironments.has(env.NODE_ENV)) {
    return localDatabaseUrl;
  }

  throw new Error(
    'DATABASE_URL is required outside local and test environments',
  );
}
