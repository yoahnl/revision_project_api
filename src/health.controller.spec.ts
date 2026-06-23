import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(() => {
    prisma.$queryRaw.mockReset();
  });

  it('returns ok', () => {
    const controller = new HealthController(prisma as never);

    expect(controller.get()).toEqual({ status: 'ok' });
  });

  it('returns ready when the database responds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const controller = new HealthController(prisma as never);

    await expect(controller.readiness()).resolves.toEqual({
      status: 'ready',
      checks: {
        database: 'ok',
      },
    });
  });

  it('returns service unavailable when the database check fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));
    const controller = new HealthController(prisma as never);

    await expect(controller.readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
