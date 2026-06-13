import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import type { AuthenticatedRequest } from './authenticated-student';
import type { TokenVerifier } from '../application/token-verifier';
import type { BootstrapStudentUseCase } from '../../students/application/bootstrap-student.use-case';

describe('FirebaseAuthGuard', () => {
  const createGuard = () => {
    const verify = jest.fn();
    const execute = jest.fn();
    const tokenVerifier: TokenVerifier = { verify };
    const bootstrapStudent = { execute } as unknown as BootstrapStudentUseCase;

    return {
      guard: new FirebaseAuthGuard(tokenVerifier, bootstrapStudent),
      verify,
      execute,
    };
  };

  const createContext = (authorization?: string) => {
    const request = {
      header: jest.fn((name: string) =>
        name.toLowerCase() === 'authorization' ? authorization : undefined,
      ),
    } as unknown as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    return { context, request };
  };

  it('rejects a missing authorization header', async () => {
    const { guard, verify, execute } = createGuard();
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing bearer token'),
    );
    expect(verify).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects an empty bearer token without verifying it', async () => {
    const { guard, verify, execute } = createGuard();
    const { context } = createContext('Bearer    ');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid bearer token'),
    );
    expect(verify).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('normalizes verifier failures to a generic unauthorized error', async () => {
    const { guard, verify, execute } = createGuard();
    const { context } = createContext('Bearer token-123');
    verify.mockRejectedValue(new Error('Firebase project secret leaked'));

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid bearer token'),
    );
    expect(verify).toHaveBeenCalledWith('token-123');
    expect(execute).not.toHaveBeenCalled();
  });

  it('attaches the bootstrapped student to the request', async () => {
    const { guard, verify, execute } = createGuard();
    const { context, request } = createContext('Bearer   token-123   ');
    const student = {
      id: 'student-1',
      firebaseUid: 'firebase-123',
      email: 'student@example.com',
      displayName: 'Karim',
    };
    verify.mockResolvedValue({
      uid: 'firebase-123',
      email: 'student@example.com',
      name: 'Karim',
    });
    execute.mockResolvedValue(student);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(verify).toHaveBeenCalledWith('token-123');
    expect(execute).toHaveBeenCalledWith({
      firebaseUid: 'firebase-123',
      email: 'student@example.com',
      displayName: 'Karim',
    });
    expect(request.student).toBe(student);
  });
});
