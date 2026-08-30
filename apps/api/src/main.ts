import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true, rawBody: true });
  app.use(helmet());
  app.getHttpAdapter().getInstance().disable?.('x-powered-by');
  app.enableShutdownHooks();
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true });
  app.setGlobalPrefix('api/v1');
  const swaggerConfig = new DocumentBuilder().setTitle('SRIP API').setDescription('Strategic Relationship Intelligence Platform API — canonical v1 contract').setVersion('1.0.0').addBearerAuth().addApiKey({ type: 'apiKey', in: 'header', name: 'Idempotency-Key' }, 'Idempotency-Key').addApiKey({ type: 'apiKey', in: 'header', name: 'X-Correlation-Id' }, 'X-Correlation-Id').build();
  const document = SwaggerModule.createDocument(app, swaggerConfig) as OpenAPIObject;
  hardenOpenApi(document);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  await app.listen(Number(process.env.API_PORT ?? 4000));
}
bootstrap();


function hardenOpenApi(document: OpenAPIObject) {
  // Keep this list aligned with AuthController's intentionally public routes.
  // These values only harden the generated OpenAPI metadata; runtime guards
  // remain the source of truth.
  const publicPrefixes = [
    '/auth/oidc',
    '/auth/register',
    '/auth/login',
    '/auth/refresh',
    '/auth/logout',
    '/auth/password-reset',
    '/auth/email/verify',
    '/health',
    '/liveness',
    '/readiness',
  ];
  const paginationParams = [
    { name: 'page', in: 'query', required: false, description: '1-based page number. Use page or cursor, not both.', schema: { type: 'integer', minimum: 1, default: 1 } },
    { name: 'cursor', in: 'query', required: false, description: 'Opaque cursor returned as nextCursor.', schema: { type: 'string' } },
    { name: 'limit', in: 'query', required: false, description: 'Maximum records returned by this request.', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
    { name: 'sort', in: 'query', required: false, description: 'Resource-specific sortable field.', schema: { type: 'string' } },
    { name: 'order', in: 'query', required: false, description: 'Sort direction.', schema: { type: 'string', enum: ['asc','desc'], default: 'desc' } },
  ];
  const collectionPath = (path: string) => {
    if (path.includes('{id}') || path.includes('{') && path.includes('}')) return false;
    return !/\/(status|health|live|ready|metrics|summary|latency|overview|search|graph|path|connectors|centrality|bridges|bottlenecks|single-points-of-failure)(\/|$)/.test(path);
  };

  document.openapi = '3.1.0';
  document.info = {
    ...document.info,
    title: 'SRIP API',
    version: '1.0.0',
    description: 'Strategic Relationship Intelligence Platform API — canonical v1 contract. REST/JSON over HTTPS with Bearer authentication, standardized errors, pagination, filtering, idempotency and webhook contracts.',
  };
  document.servers = [{ url: '/api/v1', description: 'Canonical API v1' }];
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ErrorResponse = {
    type: 'object', required: ['error'],
    properties: {
      error: {
        type: 'object', required: ['code','message','requestId','details'],
        properties: {
          code: { type: 'string', enum: ['AUTH_REQUIRED','AUTH_INVALID','ACCESS_DENIED','ORG_SCOPE_DENIED','FIELD_ACCESS_DENIED','VALIDATION_ERROR','RESOURCE_NOT_FOUND','DUPLICATE_RESOURCE','APPROVAL_REQUIRED','RATE_LIMITED','IDEMPOTENCY_CONFLICT','INTEGRATION_ERROR','INTERNAL_ERROR','SERVICE_UNAVAILABLE'], example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'Request validation failed.' },
          requestId: { type: 'string', example: '018f3f2d-7e72-7b11-8d45-9f0b7d7f2b1a' },
          details: { type: 'object', additionalProperties: true, example: {} },
        },
      },
    },
  };
  document.components.schemas.PaginatedResponse = {
    type: 'object', required: ['items'],
    properties: {
      items: { type: 'array', items: {} },
      nextCursor: { type: 'string', nullable: true, example: 'eyJpZCI6IjEyMyJ9' },
      total: { type: 'integer', minimum: 0, example: 42 },
    },
  };
  document.components.securitySchemes ??= {};
  document.components.securitySchemes.bearer = { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'OAuth/OIDC access token. Do not send refresh tokens to resource endpoints.' };
  document.components.securitySchemes['Idempotency-Key'] = { type: 'apiKey', in: 'header', name: 'Idempotency-Key', description: 'Required on retry-sensitive authenticated mutations.' };
  document.components.securitySchemes['X-Correlation-Id'] = { type: 'apiKey', in: 'header', name: 'X-Correlation-Id', description: 'Optional caller correlation identifier; echoed in tracing context.' };
  document.components.parameters ??= {};
  document.components.parameters.RequestId = { name: 'X-Request-Id', in: 'header', required: false, description: 'Request identifier; generated when absent.', schema: { type: 'string', maxLength: 255 } };
  document.components.parameters.CorrelationId = { name: 'X-Correlation-Id', in: 'header', required: false, description: 'Distributed tracing correlation identifier.', schema: { type: 'string', maxLength: 255 } };
  document.components.parameters.IdempotencyKey = { name: 'Idempotency-Key', in: 'header', required: true, description: 'Unique key for safe retries of authenticated mutations.', schema: { type: 'string', minLength: 16, maxLength: 255 } };
  document.components.responses ??= {};
  for (const [code, desc, example] of [
    ['400','Bad request or validation failure.','VALIDATION_ERROR'],
    ['401','Authentication is required or credentials are invalid.','AUTH_REQUIRED'],
    ['403','Authenticated principal is not authorized for the resource.','ACCESS_DENIED'],
    ['404','Resource not found or intentionally hidden by authorization policy.','RESOURCE_NOT_FOUND'],
    ['409','Conflict, duplicate resource, stale version or idempotency replay conflict.','DUPLICATE_RESOURCE'],
    ['422','Semantically invalid request.','VALIDATION_ERROR'],
    ['429','Rate limit exceeded.','RATE_LIMITED'],
    ['500','Unexpected server error.','INTERNAL_ERROR'],
    ['503','Dependency/service unavailable.','SERVICE_UNAVAILABLE'],
  ] as const) {
    document.components.responses[`Error${code}`] = {
      description: desc,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: { code: example, message: desc, requestId: '018f3f2d-7e72-7b11-8d45-9f0b7d7f2b1a', details: {} } } } },
    };
  }

  for (const [path, item] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!['get','post','put','patch','delete'].includes(method) || !operation || typeof operation !== 'object') continue;
      const op: any = operation;
      op.responses ??= {};
      for (const status of ['400','401','403','404','409','422','429','500','503']) {
        op.responses[status] ??= { $ref: `#/components/responses/Error${status}` };
      }
      // Swagger may expose paths with or without the global-prefix segment,
      // depending on the Nest adapter/version. Normalize both forms before
      // applying the intentionally public Auth/Health allowlist.
      const normalizedPath = path.replace(/^\/api\/v1(?=\/|$)/, '');
      const isPublic = publicPrefixes.some((p) => normalizedPath === p || normalizedPath.startsWith(`${p}/`));
      if (!isPublic) op.security = [{ bearer: [] }]; else op.security = [];
      op.parameters ??= [];
      const addParam = (p: any) => { if (!op.parameters.some((x: any) => x.name === p.name && x.in === p.in)) op.parameters.push(p); };
      addParam({ $ref: '#/components/parameters/RequestId' });
      addParam({ $ref: '#/components/parameters/CorrelationId' });
      if (method === 'get' && collectionPath(path)) for (const param of paginationParams) addParam(param);
      if ((['post','put','patch','delete'].includes(method) || /\/reports\/[^/]+\/export\/[^/]+$/.test(path)) && !isPublic) addParam({ $ref: '#/components/parameters/IdempotencyKey' });
      if (method === 'get' && collectionPath(path)) {
        op.responses[200] ??= { description: 'Successful response' };
        op.responses[200].content ??= { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } };
        op.responses[200].content['application/json'].examples ??= { success: { summary: 'Paginated collection', value: { items: [], nextCursor: null, total: 0 } } };
      } else {
        const success = method === 'post' ? '201' : '200';
        op.responses[success] ??= { description: 'Successful response' };
        op.responses[success].content ??= { 'application/json': { examples: { success: { summary: 'Successful operation', value: { success: true } } } } };
      }
      op.description = [op.description ?? '', 'Contract: authentication, authorization, standardized errors, request/correlation IDs and resource-specific filters are enforced by the API.'].filter(Boolean).join('\n\n');
    }
  }

  // OpenAPI 3.1 webhook contract: inbound signed events are not bearer-authenticated.
  (document as any).webhooks = {
    integrationWebhook: {
      post: {
        summary: 'Receive signed integration webhook',
        description: 'Provider-signed raw HTTP payload. Signature and timestamp/replay protection are verified before persistence and normalization.',
        parameters: [
          { name: 'x-webhook-signature', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'x-webhook-timestamp', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'x-event-id', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'x-event-type', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 16, maxLength: 255 } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true }, examples: { providerEvent: { value: { id: 'evt_123', type: 'meeting.updated', data: {} } } } } } },
        responses: { '200': { description: 'Webhook accepted/processed', content: { 'application/json': { example: { accepted: true } } } }, '400': { $ref: '#/components/responses/Error400' }, '401': { description: 'Invalid webhook signature' }, '409': { $ref: '#/components/responses/Error409' } },
      },
    },
  };

  const required = ['/api/v1/organizations','/api/v1/people','/api/v1/reports/{kind}','/api/v1/network/graph','/api/v1/data/import/preview','/api/v1/admin/overview'];
  const missing = required.filter((p) => !document.paths[p]);
  if (missing.length) throw new Error(`OpenAPI contract validation failed; missing paths: ${missing.join(', ')}`);
}
