import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureFlagService } from './feature-flag.service';

@Module({
  providers: [FeatureFlagService, PrismaService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
