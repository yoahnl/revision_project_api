import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { CompleteQuickRevisionSessionUseCase } from './application/complete-quick-revision-session.use-case';
import { DeleteRevisionSessionDraftAnswerUseCase } from './application/delete-revision-session-draft-answer.use-case';
import {
  GetExamPreparationSessionResultUseCase,
  GetExamPreparationSessionUseCase,
  ListCourseExamPreparationSessionHistoryUseCase,
  SubmitExamPreparationSessionUseCase,
} from './application/exam-preparation-sessions.use-cases';
import { FlagRevisionSessionQuestionUseCase } from './application/flag-revision-session-question.use-case';
import { GetResumableCourseRevisionSessionUseCase } from './application/get-resumable-course-revision-session.use-case';
import { GetRevisionSessionUseCase } from './application/get-revision-session.use-case';
import { GetRevisionSessionResultUseCase } from './application/get-revision-session-result.use-case';
import {
  ListCourseRevisionSessionHistoryUseCase,
  ListRevisionSessionHistoryUseCase,
} from './application/list-revision-session-history.use-case';
import { RequestNextRevisionSessionActionUseCase } from './application/request-next-revision-session-action.use-case';
import { REVISION_COACH_NEXT_ACTION_GENERATOR } from './application/revision-coach-next-action.generator';
import { REVISION_SESSIONS_REPOSITORY } from './application/revision-sessions.repository';
import { SaveRevisionSessionDraftAnswerUseCase } from './application/save-revision-session-draft-answer.use-case';
import { StartRevisionSessionUseCase } from './application/start-revision-session.use-case';
import { GenkitRevisionCoachNextActionGenerator } from './infrastructure/genkit-revision-coach-next-action.generator';
import { PrismaRevisionSessionsRepository } from './infrastructure/prisma-revision-sessions.repository';
import { ExamPreparationSessionsController } from './interfaces/exam-preparation-sessions.controller';
import { RevisionSessionsController } from './interfaces/revision-sessions.controller';

@Module({
  imports: [ActivitiesModule, AiModule, AuthModule, PrismaModule],
  controllers: [RevisionSessionsController, ExamPreparationSessionsController],
  providers: [
    StartRevisionSessionUseCase,
    GetRevisionSessionUseCase,
    GetResumableCourseRevisionSessionUseCase,
    SaveRevisionSessionDraftAnswerUseCase,
    DeleteRevisionSessionDraftAnswerUseCase,
    CompleteQuickRevisionSessionUseCase,
    GetExamPreparationSessionUseCase,
    SubmitExamPreparationSessionUseCase,
    GetExamPreparationSessionResultUseCase,
    ListCourseExamPreparationSessionHistoryUseCase,
    GetRevisionSessionResultUseCase,
    ListCourseRevisionSessionHistoryUseCase,
    ListRevisionSessionHistoryUseCase,
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
  exports: [
    StartRevisionSessionUseCase,
    GetResumableCourseRevisionSessionUseCase,
    ListCourseRevisionSessionHistoryUseCase,
    ListCourseExamPreparationSessionHistoryUseCase,
  ],
})
export class RevisionSessionsModule {}
