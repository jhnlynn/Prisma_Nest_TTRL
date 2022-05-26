## First Steps
The `main.ts` includes an async function, which will bootstrap our application:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

`NestFactory` exposes a few static methods that allow creating an application instance. 

The `create()` method returns an application object, which fulfills the INestApplication interface. This object provides a set of methods which are described in the coming chapters. 

In the `main.ts` example above, we simply start up our HTTP listener, which lets the application await inbound HTTP requests.


## Controllers
For quickly creating a CRUD controller with the validation built-in, you may use the CLI's CRUD generator: `nest g resource [name]`.

To create a controller using the CLI, simply execute the `$ nest g controller cats command`.

#### Standard (recommended)
Using this built-in method, when a request handler returns a JavaScript object or array, it will automatically be serialized to JSON. When it returns a JavaScript primitive type (e.g., `string`, `number`, `boolean`), however, Nest will send just the value without attempting to serialize it. This makes response handling simple: just return the value, and Nest takes care of the rest.

Furthermore, the response's status code is always 200 by default, except for POST requests which use 201. We can easily change this behavior by adding the `@HttpCode(...)` decorator at a handler-level (see Status codes).

#### Library-specific
We can use the library-specific (e.g., Express) response object, which can be injected using the `@Res()` decorator in the method handler signature (e.g., `findAll(@Res() response)`). With this approach, you have the ability to use the native response handling methods exposed by that object. For example, with Express, you can construct responses using code like `response.status(200).send()`.

#### Asynchronicity
Every async function has to return a `Promise`. This means that you can return a deferred value that Nest will be able to resolve by itself. Let's see an example of this:
```ts
@Get()
async findAll(): Promise<any[]> {
  return [];
}
```

#### Request payloads
Adding `@Post` requires DTO schema. 

Interestingly, we recommend using **classes** here. Why? Classes are part of the JavaScript ES6 standard, and therefore **they are preserved as real entities in the compiled JavaScript**. On the other hand, **since TypeScript interfaces are removed during the transpilation, Nest can't refer to them at runtime.** This is important because features such as Pipes enable additional possibilities when they have access to the metatype of the variable at runtime.

#### Takeaways for Controllers
Some Decorators disables `Standard Mode`, enables `Lib-spec Mode` instead. The Former means Nest helps you handle Req/Resp. 

To learn how to create your own custom decorators, go to this link: https://docs.nestjs.com/custom-decorators


## Providers
The main idea of a provider is that it can be **injected** as a dependency; this means objects can create various relationships with each other, and the function of "wiring up" instances of objects can largely be delegated to the Nest runtime system.

The `@Injectable()` decorator attaches metadata, which declares that `CatsService` is a class that can be managed by the Nest <u>IoC</u> container. By the way, this example also uses a `Cat` interface, which probably looks something like this:

#### Dependency injection
 In the example below, Nest will resolve the `catsService` by creating and returning an instance of `CatsService` (or, in the normal case of a singleton, returning the existing instance if it has already been requested elsewhere). This dependency is resolved and passed to your controller's constructor (or assigned to the indicated property):
```ts
constructor(private catsService: CatsService) {}
```


## Modules
Each application has at least one module, a root module. We want to emphasize that modules are strongly recommended as an effective way to organize your components. Thus, for most applications, the resulting architecture will employ multiple modules, each encapsulating a closely related set of capabilities.

#### Feature modules
A feature module simply organizes code relevant for a specific feature, keeping code organized and establishing clear boundaries. 

`cats/cats.module.ts`
```ts
import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

@Module({
  controllers: [CatsController],
  providers: [CatsService],
})
export class CatsModule {}
```

#### Shared Module
`cats.module.ts`
```ts
import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

@Module({
  controllers: [CatsController],
  providers: [CatsService],
  exports: [CatsService]
})
export class CatsModule {}
```

Now any module that imports the `CatsModule` has access to the `CatsService` and will share the same instance with all other modules that import it as well.


## Exception Filters
The `@Catch(HttpException)` decorator binds the required metadata to the exception filter, telling Nest that this particular filter is looking for exceptions of type `HttpException` and nothing else. The `@Catch()` decorator may take a single parameter, or a comma-separated list. This lets you set up the filter for several types of exceptions at once.

```ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    response
      .status(status)
      .json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
  }
}
```

#### Catch Everything
In order to catch **every** unhandled exception (regardless of the exception type), leave the `@Catch()` decorator's parameter list empty.

Typically, you'll create fully customized exception filters crafted to fulfill your application requirements. However, there might be use-cases when you would like to simply extend the built-in default **global exception filter**, and override the behavior based on certain factors.

In order to delegate exception processing to the base filter, you need to extend `BaseExceptionFilter` and call the inherited `catch()` method.

```ts
import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    super.catch(exception, host);
  }
}
```

## Pipes
#### Binding pipe
```ts
@Get(':id')
async findOne(@Param('id', ParseIntPipe) id: number) {
  return this.catsService.findOne(id);
}
```

#### Custom pipes
Every pipe must implement the `transform()` method to fulfill the `PipeTransform` interface contract. This method has two parameters:

- value
- metadata

The `value` parameter is the currently processed method argument (before it is received by the route handling method), and `metadata` is the currently processed method argument's metadata. The metadata object has these properties:
```ts
export interface ArgumentMetadata {
  type: 'body' | 'query' | 'param' | 'custom';
  metatype?: Type<unknown>;
  data?: string;
}
```

#### Object Schema Validation
The **Joi** library allows you to create schemas in a straightforward way, with a readable API. Let's build a validation pipe that makes use of Joi-based schemas.

```
$ npm install --save joi
$ npm install --save-dev @types/joi
```

As noted earlier, a **validation pipe** either returns the value unchanged, or throws an exception.

```ts
import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ObjectSchema } from 'joi';

@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(private schema: ObjectSchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
    const { error } = this.schema.validate(value);
    if (error) {
      throw new BadRequestException('Validation failed');
    }
    return value;
  }
}
```

#### Class Validator
Nest works well with the class-validator library. This powerful library allows you to use decorator-based validation. Decorator-based validation is extremely powerful, especially when combined with Nest's Pipe capabilities since we have access to the `metatype` of the processed property. Before we start, we need to install the required packages:

```
npm i --save class-validator class-transformer
```

we can add a few decorators to the `CreateCatDto` class.

#### Providing defaults
To allow an endpoint to handle missing querystring parameter values, we have to provide a default value to be injected before the `Parse*` pipes operate on these values. 
```ts
@Get()
async findAll(
  @Query('activeOnly', new DefaultValuePipe(false), ParseBoolPipe) activeOnly: boolean,
  @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
) {
  return this.catsService.findAll({ activeOnly, page });
}
```


## Guards
Every guard must implement a `canActivate()` function. This function should return a boolean, indicating whether the current request is allowed or not. It can return the response either synchronously or asynchronously (via a `Promise` or `Observable`). Nest uses the return value to control the next action:

if it returns `true`, the request will be processed.
if it returns `false`, Nest will deny the request.

#### Role-based authentication
```ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return true;
  }
}
```

#### Setting roles per handler
`RBAC`
```ts
// roles is a key, while ['admin'] is a particular value
@SetMetadata('roles', ['admin'])
```

While the above works, it's not good practice to use `@SetMetadata()` directly in your routes. Instead, create your own decorators, as shown below:
```ts
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

```ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    return matchRoles(roles, user.roles);
  }
}
```

**HINT**
In the node.js world, it's common practice to attach the authorized user to the `request` object. Thus, in our sample code above, we are assuming that request.user contains the user instance and allowed roles. In your app, you will probably make that association in your custom `authentication guard` (or middleware). Here for more info about authentication: https://docs.nestjs.com/security/authentication


## Interceptors
Interceptors have a set of useful capabilities which are inspired by the **Aspect Oriented Programming (AOP)** technique. 

#### Basics
Each interceptor implements the `intercept()` method, which takes two arguments.

- `ExecutionContext`
- `CallHandler` 

#### Aspect Interceptor
```ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('Before...');

    const now = Date.now();
    return next
      .handle()
      .pipe(
        tap(() => console.log(`After... ${Date.now() - now}ms`)),
      );
  }
}
```

#### Binding Interceptors
```ts
@UseInterceptors(LoggingInterceptor)
export class CatsController {}
```

#### Response Mapping
We already know that `handle()` returns an `Observable`. The stream contains the value **returned** from the route handler, and thus we can easily mutate it using RxJS's `map()` operator.

#### Exception Mapping


#### Main Takeaways
Interceptors have great value in creating re-usable solutions to requirements that occur across an entire application. 


## Custom Route Decorators
In order to make your code more readable and transparent, you can create a `@User()` decorator and reuse it across all of your controllers.

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

Then, you can simply use it wherever it fits your requirements.

```ts
@Get()
async findOne(@User() user: UserEntity) {
  console.log(user);
}
```

#### Working w/ Pipes
you can apply the pipe directly to the custom decorator:
```ts
@Get()
async findOne(
  @User(new ValidationPipe({ validateCustomDecorators: true }))
  user: UserEntity,
) {
  console.log(user);
}
```


