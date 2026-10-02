import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const origins = process.env.WEB_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [];
  if (process.env.NODE_ENV === 'production') {
    if (!origins.length) throw new Error('Set WEB_ORIGIN to the HTTPS origin of the production web app');
    for (const origin of origins) {
      let parsedOrigin: URL;
      try {
        parsedOrigin = new URL(origin);
      } catch {
        throw new Error('WEB_ORIGIN must contain valid HTTPS origins without paths');
      }
      if (parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== origin) {
        throw new Error('WEB_ORIGIN must contain valid HTTPS origins without paths');
      }
    }
  }

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: origins?.length ? origins : [/^http:\/\/localhost(:\d+)?$/] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((_request: any, response: any, next: (error?: Error) => void) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

void bootstrap();
