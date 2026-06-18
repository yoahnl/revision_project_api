import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AuthModule } from './modules/auth/auth.module';
import { CoursesModule } from './modules/courses/courses.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { RevisionModule } from './modules/revision/revision.module';
import { RevisionSessionsModule } from './modules/revision-sessions/revision-sessions.module';
import { StudyArtifactsModule } from './modules/study-artifacts/study-artifacts.module';
import { SubjectsModule } from './modules/subjects/subjects.module';

@Module({
  imports: [
    AuthModule,
    SubjectsModule,
    RevisionModule,
    CoursesModule,
    DocumentsModule,
    ActivitiesModule,
    RevisionSessionsModule,
    StudyArtifactsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
