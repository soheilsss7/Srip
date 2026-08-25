import { Global, Module } from '@nestjs/common';
import { ApiContractInterceptor } from './api-contract.interceptor';
import { ApiContractContextMiddleware } from './api-contract.middleware';

@Global()
@Module({ providers: [ApiContractInterceptor, ApiContractContextMiddleware], exports: [ApiContractInterceptor, ApiContractContextMiddleware] })
export class ApiContractModule {}
