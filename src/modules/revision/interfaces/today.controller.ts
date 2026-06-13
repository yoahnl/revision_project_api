import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import { GetTodayPlanUseCase } from '../application/get-today-plan.use-case';

@Controller('today')
@UseGuards(FirebaseAuthGuard)
export class TodayController {
  constructor(private readonly getTodayPlan: GetTodayPlanUseCase) {}

  @Get()
  get(@CurrentStudent() student: { id: string }) {
    return this.getTodayPlan.execute({ studentId: student.id });
  }
}
