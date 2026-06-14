import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { AdaptivePlanService } from '../revision/domain/adaptive-plan.service';
import { RevisionModule } from '../revision/revision.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { ACTIVITIES_REPOSITORY } from './application/activities.repository';
import { DIAGNOSTIC_QUIZ_GENERATOR } from './application/diagnostic-quiz-generator';
import { StartNextActivityUseCase } from './application/start-next-activity.use-case';
import { SubmitActivityResultUseCase } from './application/submit-activity-result.use-case';
import { GenkitDiagnosticQuizGenerator } from './infrastructure/genkit-diagnostic-quiz.generator';
import { PrismaActivitiesRepository } from './infrastructure/prisma-activities.repository';
import { ActivitiesController } from './interfaces/activities.controller';

@Module({
  imports: [AiModule, AuthModule, PrismaModule, RevisionModule],
  controllers: [ActivitiesController],
  providers: [
    AdaptivePlanService,
    StartNextActivityUseCase,
    SubmitActivityResultUseCase,
    {
      provide: ACTIVITIES_REPOSITORY,
      useClass: PrismaActivitiesRepository,
    },
    {
      provide: DIAGNOSTIC_QUIZ_GENERATOR,
      useClass: GenkitDiagnosticQuizGenerator,
    },
  ],
})
export class ActivitiesModule {}
