import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { FieldSecurityService } from '../common/authorization/field-security.service';
import { Reflector } from '@nestjs/core';
@Module({ providers: [
        PermissionsService, AuthorizationGuard, Reflector
    ], exports: [PermissionsService, AuthorizationService, AuthorizationGuard, FieldSecurityService, PrismaService] })
export class PermissionsModule {
}
