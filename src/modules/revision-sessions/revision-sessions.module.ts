import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { GetRevisionSessionUseCase } from './application/get-revision-session.use-case';
import { REVISION_SESSIONS_REPOSITORY } from './application/revision-sessions.repository';
import { StartRevisionSessionUseCase } from './application/start-revision-session.use-case';
import { PrismaRevisionSessionsRepository } from './infrastructure/prisma-revision-sessions.repository';
import { RevisionSessionsController } from './interfaces/revision-sessions.controller';

@Module({
  imports: [ActivitiesModule, AuthModule, PrismaModule],
  controllers: [RevisionSessionsController],
  providers: [
    StartRevisionSessionUseCase,
    GetRevisionSessionUseCase,
    {
      provide: REVISION_SESSIONS_REPOSITORY,
      useClass: PrismaRevisionSessionsRepository,
    },
  ],
})
export class RevisionSessionsModule {}
