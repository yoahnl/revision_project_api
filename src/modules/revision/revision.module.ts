import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SUBJECTS_REPOSITORY } from '../subjects/application/subjects.repository';
import { PrismaSubjectsRepository } from '../subjects/infrastructure/prisma-subjects.repository';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { GetTodayPlanUseCase } from './application/get-today-plan.use-case';
import { REVISION_REPOSITORY } from './application/revision.repository';
import { SaveRevisionGoalUseCase } from './application/save-revision-goal.use-case';
import { AdaptivePlanService } from './domain/adaptive-plan.service';
import { PrismaRevisionRepository } from './infrastructure/prisma-revision.repository';
import { RevisionGoalsController } from './interfaces/revision-goals.controller';
import { TodayController } from './interfaces/today.controller';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [RevisionGoalsController, TodayController],
  providers: [
    AdaptivePlanService,
    GetTodayPlanUseCase,
    SaveRevisionGoalUseCase,
    {
      provide: REVISION_REPOSITORY,
      useClass: PrismaRevisionRepository,
    },
    {
      provide: SUBJECTS_REPOSITORY,
      useClass: PrismaSubjectsRepository,
    },
  ],
  exports: [REVISION_REPOSITORY],
})
export class RevisionModule {}
