import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { resolvePrismaDatabaseUrl } from './src/shared/infrastructure/prisma/database-url';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: resolvePrismaDatabaseUrl(),
  },
});
