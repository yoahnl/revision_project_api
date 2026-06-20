import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { CompleteQuickRevisionSessionUseCase } from './application/complete-quick-revision-session.use-case';
import { FlagRevisionSessionQuestionUseCase } from './application/flag-revision-session-question.use-case';
import { GetRevisionSessionUseCase } from './application/get-revision-session.use-case';
import { GetRevisionSessionResultUseCase } from './application/get-revision-session-result.use-case';
import { RequestNextRevisionSessionActionUseCase } from './application/request-next-revision-session-action.use-case';
import { REVISION_COACH_NEXT_ACTION_GENERATOR } from './application/revision-coach-next-action.generator';
import { REVISION_SESSIONS_REPOSITORY } from './application/revision-sessions.repository';
import { StartRevisionSessionUseCase } from './application/start-revision-session.use-case';
import { GenkitRevisionCoachNextActionGenerator } from './infrastructure/genkit-revision-coach-next-action.generator';
import { PrismaRevisionSessionsRepository } from './infrastructure/prisma-revision-sessions.repository';
import { RevisionSessionsController } from './interfaces/revision-sessions.controller';

@Module({
  imports: [ActivitiesModule, AiModule, AuthModule, PrismaModule],
  controllers: [RevisionSessionsController],
  providers: [
    StartRevisionSessionUseCase,
    GetRevisionSessionUseCase,
    CompleteQuickRevisionSessionUseCase,
    GetRevisionSessionResultUseCase,
    FlagRevisionSessionQuestionUseCase,
    RequestNextRevisionSessionActionUseCase,
    {
      provide: REVISION_COACH_NEXT_ACTION_GENERATOR,
      useClass: GenkitRevisionCoachNextActionGenerator,
    },
    {
      provide: REVISION_SESSIONS_REPOSITORY,
      useClass: PrismaRevisionSessionsRepository,
    },
  ],
  exports: [StartRevisionSessionUseCase],
})
export class RevisionSessionsModule {}
