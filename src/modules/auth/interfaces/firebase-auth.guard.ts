import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TOKEN_VERIFIER } from '../application/token-verifier';
import type {
  TokenVerifier,
  VerifiedFirebaseToken,
} from '../application/token-verifier';
import { BootstrapStudentUseCase } from '../../students/application/bootstrap-student.use-case';
import type { AuthenticatedRequest } from './authenticated-student';

export type {
  AuthenticatedRequest,
  AuthenticatedStudent,
} from './authenticated-student';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly tokenVerifier: TokenVerifier,
    private readonly bootstrapStudent: BootstrapStudentUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header('authorization');

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice('Bearer '.length).trim();

    if (!token) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    let verified: VerifiedFirebaseToken;
    try {
      verified = await this.tokenVerifier.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }

    request.student = await this.bootstrapStudent.execute({
      firebaseUid: verified.uid,
      email: verified.email,
      displayName: verified.name,
    });

    return true;
  }
}
