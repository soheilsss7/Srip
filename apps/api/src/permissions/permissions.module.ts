import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { Reflector } from '@nestjs/core';
@Module({ providers: [
        PermissionsService, AuthorizationGuard, Reflector
    ], exports: [PermissionsService, AuthorizationGuard] })
export class PermissionsModule {
}
