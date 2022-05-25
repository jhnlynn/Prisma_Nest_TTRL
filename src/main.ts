import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';

// Issues with enableShutdownHooks
/*
Prisma interferes with NestJS enableShutdownHooks. 
Prisma listens for shutdown signals and will call process.exit() 
before your application shutdown hooks fire. 

To deal with this, you would need to add a listener for Prisma beforeExit event.
*/
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app)
}
bootstrap();
