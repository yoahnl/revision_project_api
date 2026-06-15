import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { AdaptivePlanService } from '../revision/domain/adaptive-plan.service';
import { RevisionModule } from '../revision/revision.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { ACTIVITIES_REPOSITORY } from './application/activities.repository';
import { DIAGNOSTIC_QUIZ_GENERATOR } from './application/diagnostic-quiz-generator';
import { OPEN_ANSWER_EVALUATOR } from './application/open-answer-evaluator';
import { OPEN_QUESTION_GENERATOR } from './application/open-question-generator';
import { StartOpenQuestionActivityUseCase } from './application/start-open-question-activity.use-case';
import { StartNextActivityUseCase } from './application/start-next-activity.use-case';
import { SubmitOpenAnswerUseCase } from './application/submit-open-answer.use-case';
import { SubmitActivityResultUseCase } from './application/submit-activity-result.use-case';
import { GenkitDiagnosticQuizGenerator } from './infrastructure/genkit-diagnostic-quiz.generator';
import { GenkitOpenAnswerEvaluator } from './infrastructure/genkit-open-answer.evaluator';
import { GenkitOpenQuestionGenerator } from './infrastructure/genkit-open-question.generator';
import { PrismaActivitiesRepository } from './infrastructure/prisma-activities.repository';
import { ActivitiesController } from './interfaces/activities.controller';

@Module({
  imports: [AiModule, AuthModule, PrismaModule, RevisionModule],
  controllers: [ActivitiesController],
  providers: [
    AdaptivePlanService,
    StartNextActivityUseCase,
    StartOpenQuestionActivityUseCase,
    SubmitActivityResultUseCase,
    SubmitOpenAnswerUseCase,
    {
      provide: ACTIVITIES_REPOSITORY,
      useClass: PrismaActivitiesRepository,
    },
    {
      provide: DIAGNOSTIC_QUIZ_GENERATOR,
      useClass: GenkitDiagnosticQuizGenerator,
    },
    {
      provide: OPEN_QUESTION_GENERATOR,
      useClass: GenkitOpenQuestionGenerator,
    },
    {
      provide: OPEN_ANSWER_EVALUATOR,
      useClass: GenkitOpenAnswerEvaluator,
    },
  ],
  exports: [StartNextActivityUseCase, StartOpenQuestionActivityUseCase],
})
export class ActivitiesModule {}
