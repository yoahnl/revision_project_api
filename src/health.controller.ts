import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './shared/infrastructure/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  get() {
    return { status: 'ok' };
  }

  @Get('readiness')
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        checks: {
          database: 'ok',
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: {
          database: 'unavailable',
        },
      });
    }
  }
}
