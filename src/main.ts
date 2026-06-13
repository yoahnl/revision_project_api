import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureCors } from './cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  configureCors(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
