import 'dotenv/config';
import fastifyCookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  await app.register(fastifyCookie);

  if (process.env.NODE_ENV !== 'production') {
    const adminDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Admin API')
        .setDescription('Administrative API surface')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('admin/docs', app, adminDocument);

    const webDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Web API')
        .setDescription('Web API surface')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('web/docs', app, webDocument);

    const mobileDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Mobile API')
        .setDescription('Mobile API surface')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('mobile/docs', app, mobileDocument);
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
