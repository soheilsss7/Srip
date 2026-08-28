import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { RELATIONSHIP_SCORE_FACTORS } from './relationship-score.service';

type WeightConfig = Record<string, unknown>;
const FACTORS = [...RELATIONSHIP_SCORE_FACTORS];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function number(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new BadRequestException('Score weights must be finite non-negative numbers');
  return n;
}

/**
 * Score configuration is stored as versioned JSON so administrators can change
 * scoring policy without a code deployment. Percentages are accepted as 0..100.
 *
 * `otherWeight` is a group weight: when supplied for an industry profile,
 * the unspecified canonical factors share that percentage equally.
 */
function normalizeProfile(input: WeightConfig, requireHundred = true): WeightConfig {
  const output: WeightConfig = {};
  for (const key of Object.keys(input)) {
    if (key !== 'otherWeight' && !FACTORS.includes(key as any)) {
      throw new BadRequestException(`Unknown relationship score factor: ${key}`);
    }
    output[key] = number(input[key]);
  }

  const other = output.otherWeight as number | undefined;
  const specified = FACTORS.filter(f => Object.prototype.hasOwnProperty.call(output, f));
  const specifiedTotal = specified.reduce((s, f) => s + Number(output[f]), 0);

  if (other !== undefined) {
    const remaining = FACTORS.filter(f => !specified.includes(f));
    if (!remaining.length && other > 0) throw new BadRequestException('otherWeight requires at least one unspecified factor');
    const total = specifiedTotal + other;
    if (requireHundred && Math.abs(total - 100) > 0.000001) {
      throw new BadRequestException(`Weight profile must total 100%; received ${total}`);
    }
  } else if (requireHundred) {
    if (specified.length !== FACTORS.length) throw new BadRequestException('All canonical factors are required unless otherWeight is supplied');
    if (Math.abs(specifiedTotal - 100) > 0.000001) {
      throw new BadRequestException(`Weight profile must total 100%; received ${specifiedTotal}`);
    }
  }

  return output;
}

function validateWeightsDocument(weights: unknown): Record<string, unknown> {
  if (!isRecord(weights)) throw new BadRequestException('weights must be an object');
  const directKeys = Object.keys(weights).filter(k => k !== 'default' && k !== 'industries');
  if (directKeys.length) normalizeProfile(weights, false);

  if (weights.default !== undefined) {
    if (!isRecord(weights.default)) throw new BadRequestException('weights.default must be an object');
    normalizeProfile(weights.default, false);
  }

  if (weights.industries !== undefined) {
    if (!isRecord(weights.industries)) throw new BadRequestException('weights.industries must be an object');
    for (const [industry, profile] of Object.entries(weights.industries)) {
      if (!industry.trim() || !isRecord(profile)) throw new BadRequestException('Each industry profile must be an object');
      normalizeProfile(profile, true);
    }
  }
  return weights;
}

@Injectable()
export class ScoreVersioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  private async assertAdmin(userId: string, organizationId?: string) {
    await this.authorization.assertPermission(userId, 'scoring.admin', {
      organizationId,
    });
  }

  async list(userId: string) {
    await this.assertAdmin(userId);
    const rows = await this.prisma.scoreVersion.findMany({
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
    });
    return EntityResponseDto.manyUnknown(rows);
  }

  async create(userId: string, body: any) {
    const name = String(body?.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');
    const weights = validateWeightsDocument(body?.weights ?? {});
    await this.assertAdmin(userId, body?.organizationId);

    const latest = await this.prisma.scoreVersion.findFirst({ where: { name }, orderBy: { version: 'desc' } });
    const created = await this.prisma.scoreVersion.create({
      data: {
        name,
        version: (latest?.version ?? 0) + 1,
        status: 'DRAFT',
        weights: weights as Prisma.InputJsonValue,
        calibrationNotes: body?.calibrationNotes ?? body?.notes ?? null,
        createdById: userId,
      },
    });
    await this.audit.logMutation({
      userId,
      action: 'CREATE',
      entityType: 'ScoreVersion',
      entityId: created.id,
      organizationId: body?.organizationId,
      before: null,
      after: created,
      reason: 'score-version-created',
    });
    return EntityResponseDto.fromUnknown({ ...created, organizationId: body?.organizationId ?? undefined });
  }

  async configureIndustry(userId: string, body: any) {
    const industry = String(body?.industry ?? '').trim();
    if (!industry) throw new BadRequestException('industry is required');
    const profile = normalizeProfile(body?.weights ?? {}, true);
    await this.assertAdmin(userId, body?.organizationId);

    const active = await this.prisma.scoreVersion.findFirst({
      where: { name: String(body?.name ?? 'relationship-default'), status: 'ACTIVE' },
      orderBy: { version: 'desc' },
    });
    const source = isRecord(active?.weights) ? active!.weights as Record<string, unknown> : {};
    const industries = isRecord(source.industries) ? { ...source.industries } : {};
    industries[industry] = profile;

    const weights = {
      ...source,
      industries,
      default: source.default ?? {},
    };
    return this.create(userId, {
      name: body?.name ?? 'relationship-default',
      weights,
      organizationId: body?.organizationId,
      calibrationNotes: body?.calibrationNotes ?? `Industry profile configured for ${industry}`,
    });
  }

  async updateDraft(userId: string, id: string, body: any) {
    const current = await this.prisma.scoreVersion.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Score version not found');
    if (current.status !== 'DRAFT') throw new BadRequestException('Only DRAFT score versions can be edited');
    await this.assertAdmin(userId);

    const weights = body?.weights !== undefined ? validateWeightsDocument(body.weights) : current.weights;
    const updated = await this.prisma.scoreVersion.update({
      where: { id },
      data: {
        weights: weights as any,
        calibrationNotes: body?.calibrationNotes ?? body?.notes ?? current.calibrationNotes,
      },
    });
    await this.audit.logMutation({
      userId, action: 'UPDATE', entityType: 'ScoreVersion', entityId: id,
      before: current, after: updated, reason: 'score-version-draft-updated',
    });
    return EntityResponseDto.fromUnknown(updated);
  }

  async activate(userId: string, id: string) {
    const target = await this.prisma.scoreVersion.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Score version not found');
    if (target.status === 'ACTIVE') return EntityResponseDto.fromUnknown(target);
    await this.assertAdmin(userId);

    validateWeightsDocument(target.weights);
    const activated = await this.prisma.$transaction(async tx => {
      await tx.scoreVersion.updateMany({
        where: { name: target.name, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });
      return tx.scoreVersion.update({ where: { id }, data: { status: 'ACTIVE' } });
    });
    await this.audit.logMutation({
      userId, action: 'UPDATE', entityType: 'ScoreVersion', entityId: id,
      before: target, after: activated, reason: 'score-version-activated',
    });
    return EntityResponseDto.fromUnknown(activated);
  }

  async calibrations(userId: string, versionId: string) {
    await this.assertAdmin(userId);
    const rows = await this.prisma.scoreCalibration.findMany({
      where: { scoreVersionId: versionId },
      orderBy: { createdAt: 'desc' },
    });
    return EntityResponseDto.manyUnknown(rows);
  }

  async addCalibration(userId: string, versionId: string, body: any) {
    await this.assertAdmin(userId);
    const version = await this.prisma.scoreVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Score version not found');

    const expectedScore = Math.round(number(body?.expectedScore));
    const observedScore = Math.round(number(body?.observedScore));
    if (expectedScore > 100 || observedScore > 100) throw new BadRequestException('Calibration scores must be between 0 and 100');

    const calibration = await this.prisma.scoreCalibration.create({
      data: {
        scoreVersionId: versionId,
        relationshipId: body?.relationshipId ?? null,
        observedOutcome: String(body?.observedOutcome ?? '').trim(),
        expectedScore,
        observedScore,
        notes: body?.notes ?? null,
      },
    });
    await this.audit.logMutation({
      userId, action: 'CREATE', entityType: 'ScoreCalibration', entityId: calibration.id,
      before: null, after: calibration, reason: 'score-calibration-created',
    });
    return EntityResponseDto.fromUnknown(calibration);
  }
}
