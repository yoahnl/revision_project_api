import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthenticatedStudent,
} from './authenticated-student';

export const CurrentStudent = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedStudent => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.student) {
      throw new Error('CurrentStudent used without FirebaseAuthGuard');
    }

    return request.student;
  },
);
