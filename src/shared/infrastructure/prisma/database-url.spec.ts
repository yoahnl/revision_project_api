import { resolvePrismaDatabaseUrl } from './database-url';

describe('resolvePrismaDatabaseUrl', () => {
  it('uses DATABASE_URL when it is configured', () => {
    expect(
      resolvePrismaDatabaseUrl({
        DATABASE_URL: 'postgresql://example.test/revision',
        NODE_ENV: 'production',
      }),
    ).toBe('postgresql://example.test/revision');
  });

  it('uses the local database URL in local and test environments', () => {
    expect(resolvePrismaDatabaseUrl({ NODE_ENV: 'test' })).toBe(
      'postgresql://revision:revision@localhost:5432/revision?schema=public',
    );
    expect(resolvePrismaDatabaseUrl({ NODE_ENV: undefined })).toBe(
      'postgresql://revision:revision@localhost:5432/revision?schema=public',
    );
  });

  it('requires DATABASE_URL outside local and test environments', () => {
    expect(() => resolvePrismaDatabaseUrl({ NODE_ENV: 'production' })).toThrow(
      'DATABASE_URL is required outside local and test environments',
    );
  });
});
