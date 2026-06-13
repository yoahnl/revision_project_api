import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { TOKEN_VERIFIER } from '../../auth/application/token-verifier';
import { STUDENTS_REPOSITORY } from '../application/students.repository';
import type { StudentsRepository } from '../application/students.repository';

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

describe('StudentsController', () => {
  let app: INestApplication<App>;
  let studentsRepository: StudentsRepository;
  let createFromFirebaseUser: jest.MockedFunction<
    StudentsRepository['createFromFirebaseUser']
  >;

  beforeEach(async () => {
    createFromFirebaseUser = jest.fn().mockResolvedValue({
      id: 'student-1',
      firebaseUid: 'firebase-123',
      email: null,
      displayName: 'Karim',
    });

    studentsRepository = {
      findByFirebaseUid: jest.fn().mockResolvedValue(null),
      createFromFirebaseUser,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue({
        verify: jest.fn().mockResolvedValue({
          uid: 'firebase-123',
          email: null,
          name: 'Karim',
        }),
      })
      .overrideProvider(STUDENTS_REPOSITORY)
      .useValue(studentsRepository)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('rejects /students/me without a bearer token', async () => {
    await request(app.getHttpServer()).get('/students/me').expect(401);
  });

  it('bootstraps and returns the current student profile', async () => {
    await request(app.getHttpServer())
      .get('/students/me')
      .set('Authorization', 'Bearer firebase-id-token')
      .expect(200)
      .expect({
        id: 'student-1',
        firebaseUid: 'firebase-123',
        email: null,
        displayName: 'Karim',
      });

    expect(createFromFirebaseUser).toHaveBeenCalledWith({
      firebaseUid: 'firebase-123',
      email: null,
      displayName: 'Karim',
    });
  });
});
