import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import type { AuthenticatedStudent } from '../../auth/interfaces/authenticated-student';

@Controller('students')
@UseGuards(FirebaseAuthGuard)
export class StudentsController {
  @Get('me')
  me(@CurrentStudent() student: AuthenticatedStudent): AuthenticatedStudent {
    return student;
  }
}
