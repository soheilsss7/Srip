import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { EventBusService } from '../event-bus/event-bus.service';

@Injectable()
export class WorkflowApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  async request(userId: string, executionId: string, payload: unknown, nextActionIndex?: number) {
    const execution = await this.prisma.workflowExecution.findUnique({ where: { id: executionId }, include: { workflow: true } });
    if (!execution) throw new NotFoundException('Execution not found');
    if (execution.workflow.organizationId) {
      await this.authorization.assertPermission(userId, 'workflow.execute', {
        organizationId: execution.workflow.organizationId, entityType: 'WorkflowExecution', entityId: executionId,
      });
    }
    const nextIndex = nextActionIndex ?? execution.currentActionIndex;
    return this.eventBus.transaction(async tx => {
      const created = await tx.workflowApproval.create({
        data: { workflowExecutionId: executionId, requestedById: userId, payload: payload as Prisma.InputJsonValue, status: 'PENDING' },
      });
      await tx.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'WAITING', resumeAt: null, currentActionIndex: nextIndex,
          context: { ...((execution.context as Record<string, unknown>) ?? {}), pendingApprovalId: created.id } as Prisma.InputJsonValue,
        },
      });
      await this.audit.logMutation({
        userId, action: 'APPROVAL_REQUESTED', entityType: 'WorkflowApproval', entityId: created.id,
        organizationId: execution.workflow.organizationId ?? undefined,
        after: { status: 'PENDING', workflowExecutionId: executionId, nextActionIndex: nextIndex },
        reason: 'workflow-approval-requested',
      }, tx);
      return created;
    });
  }

  async decide(userId: string, approvalId: string, decision: 'APPROVED' | 'REJECTED', reason?: string) {
    if (decision !== 'APPROVED' && decision !== 'REJECTED') throw new BadRequestException('Invalid approval decision');
    const approval = await this.prisma.workflowApproval.findUnique({
      where: { id: approvalId }, include: { execution: { include: { workflow: true } } },
    });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.status !== 'PENDING') throw new BadRequestException('Approval already decided');
    if (approval.execution.workflow.organizationId) {
      await this.authorization.assertPermission(userId, 'workflow.execute', {
        organizationId: approval.execution.workflow.organizationId, entityType: 'WorkflowExecution', entityId: approval.workflowExecutionId,
      });
    }

    return this.eventBus.transaction(async tx => {
      const changed = await tx.workflowApproval.updateMany({
        where: { id: approvalId, status: 'PENDING' },
        data: { status: decision, decidedById: userId, decisionReason: reason, decidedAt: new Date() },
      });
      if (changed.count !== 1) throw new BadRequestException('Approval already decided');
      const updated = await tx.workflowApproval.findUniqueOrThrow({ where: { id: approvalId } });
      const nextContext = {
        ...((approval.execution.context as Record<string, unknown>) ?? {}),
        approvalDecision: decision, approvalReason: reason ?? null, pendingApprovalId: null,
      };
      await this.audit.logMutation({
        userId, action: decision === 'APPROVED' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
        entityType: 'WorkflowApproval', entityId: updated.id,
        organizationId: approval.execution.workflow.organizationId ?? undefined,
        before: { status: 'PENDING' }, after: { status: decision },
        reason: reason ?? 'workflow-approval-decision',
      }, tx);
      if (decision === 'REJECTED') {
        const rejected = await tx.workflowExecution.update({
          where: { id: approval.workflowExecutionId },
          data: { status: 'REJECTED', finishedAt: new Date(), resumeAt: null, context: nextContext as Prisma.InputJsonValue },
        });
        await this.audit.logMutation({
          userId, action: 'APPROVAL_REJECTED', entityType: 'WorkflowExecution', entityId: rejected.id,
          organizationId: approval.execution.workflow.organizationId ?? undefined,
          before: { status: 'WAITING' }, after: { status: 'REJECTED' },
          reason: reason ?? 'workflow-approval-rejected',
        }, tx);
      } else {
        await tx.workflowExecution.update({
          where: { id: approval.workflowExecutionId },
          data: { status: 'RUNNING', finishedAt: null, resumeAt: null, context: nextContext as Prisma.InputJsonValue },
        });
      }
      return {
        approval: updated,
        decision,
        workflowExecutionId: approval.workflowExecutionId,
        resumeFromIndex: approval.execution.currentActionIndex ?? 0,
      };
    });
  }
}
