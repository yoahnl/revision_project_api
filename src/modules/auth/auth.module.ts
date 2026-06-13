import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { StudentsController } from '../students/interfaces/students.controller';
import { TOKEN_VERIFIER } from './application/token-verifier';
import { FirebaseTokenVerifier } from './infrastructure/firebase-token-verifier';
import { FirebaseAuthGuard } from './interfaces/firebase-auth.guard';

@Module({
  imports: [StudentsModule],
  controllers: [StudentsController],
  providers: [
    FirebaseAuthGuard,
    {
      provide: TOKEN_VERIFIER,
      useClass: FirebaseTokenVerifier,
    },
  ],
  exports: [FirebaseAuthGuard, TOKEN_VERIFIER, StudentsModule],
})
export class AuthModule {}
