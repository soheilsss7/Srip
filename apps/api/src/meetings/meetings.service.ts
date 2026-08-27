import { Injectable, NotFoundException } from '@nestjs/common';
import { MeetingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';
import { DataLifecycleService } from '../common/data-lifecycle/data-lifecycle.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { parsePagination } from '../common/pagination';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService, private readonly eventBus: EventBusService, private readonly lifecycle: DataLifecycleService) {}

  private async assertAccess(userId: string, row: any) {
    const orgIds = [row.organizationId, row.relationship?.sourceOrganizationId, row.relationship?.targetOrganizationId].filter(Boolean) as string[];
    if (orgIds.length) return this.authorization.assertAnyOrganizationAccess(userId, orgIds);
    if (row.ownerId !== userId) throw new NotFoundException('Meeting not found');
  }

  async list(userId: string, relationshipId?: string, upcoming = false, page?: string, pageSize?: string) {
    const ids = await this.authorization.accessibleOrganizationIds(userId);
    const p = parsePagination(page, pageSize, { page: 1, pageSize: 50 });
    const where: Prisma.MeetingWhereInput = { deletedAt: null, ...(relationshipId ? { relationshipId } : {}), ...(upcoming ? { startAt: { gte: new Date() } } : {}), ...(ids ? { OR: [{ organizationId: { in: ids } }, { ownerId: userId }, { relationship: { OR: [{ sourceOrganizationId: { in: ids } }, { targetOrganizationId: { in: ids } }] } }] } : { ownerId: userId }) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.meeting.findMany({ where, include: { organization: true, relationship: true, participants: { include: { person: true } }, actions: true, commitments: true }, orderBy: { startAt: 'desc' }, skip: p.skip, take: p.take }),
      this.prisma.meeting.count({ where }),
    ]);
    return { items: EntityResponseDto.many('Meeting', items), page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) };
  }

  private async fetch(userId: string, id: string) {
    const row = await this.prisma.meeting.findUnique({ where: { id }, include: { organization: true, relationship: { select: { id: true, sourceOrganizationId: true, targetOrganizationId: true, status: true, healthScore: true } }, participants: { include: { person: true } }, actions: true, commitments: true } });
    if (!row || row.deletedAt) throw new NotFoundException('Meeting not found');
    await this.assertAccess(userId, row);
    return row;
  }

  async get(userId: string, id: string) {
    return EntityResponseDto.from('Meeting', await this.fetch(userId, id));
  }

  private async validateParticipants(userId: string, participantIds: string[], relationshipId?: string, organizationId?: string) {
    const unique = [...new Set(participantIds)];
    const people = unique.length ? await this.prisma.person.findMany({ where: { id: { in: unique }, deletedAt: null }, select: { id: true, organizationId: true } }) : [];
    if (people.length !== unique.length) throw new NotFoundException('One or more participants not found');
    const allowedOrgs: string[] = [];
    if (organizationId) allowedOrgs.push(organizationId);
    if (relationshipId) { const r = await this.prisma.relationship.findUnique({ where: { id: relationshipId }, select: { sourceOrganizationId: true, targetOrganizationId: true } }); if (!r) throw new NotFoundException('Relationship not found'); allowedOrgs.push(r.sourceOrganizationId, r.targetOrganizationId); }
    if (people.length) await this.authorization.assertAnyOrganizationAccess(userId, people.map(p => p.organizationId).filter((id): id is string => !!id));
    return unique;
  }

  async create(userId: string, data: any) {
    if (data.organizationId) await this.authorization.assertPermission(userId, 'meeting.write', { organizationId: data.organizationId });
    if (data.relationshipId) { const r = await this.prisma.relationship.findUnique({ where: { id: data.relationshipId }, select: { sourceOrganizationId: true, targetOrganizationId: true } }); if (!r) throw new NotFoundException('Relationship not found'); await this.authorization.assertAnyOrganizationAccess(userId, [r.sourceOrganizationId, r.targetOrganizationId]); }
    const participantIds = await this.validateParticipants(userId, data.participantPersonIds ?? [], data.relationshipId, data.organizationId);
    const { participantPersonIds, ...meeting } = data;
    const payload: any = { ...meeting, ownerId: userId, startAt: new Date(data.startAt), endAt: data.endAt ? new Date(data.endAt) : undefined };
    const created = await this.eventBus.transaction(async tx => {
      const row = await tx.meeting.create({ data: { ...payload, participants: participantIds.length ? { create: participantIds.map(personId => ({ personId })) } : undefined }, include: { participants: { include: { person: true } }, organization: true, relationship: true } });
      await this.audit.logMutation({ userId, action: 'CREATE', entityType: 'Meeting', entityId: row.id, organizationId: row.organizationId ?? undefined, after: row }, tx);
      await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.MEETING_CREATED, aggregateType: 'Meeting', aggregateId: row.id, organizationId: row.organizationId ?? undefined, actorId: userId, payload: row as any });
      return row;
    });
    return EntityResponseDto.from('Meeting', created);
  }

  async update(userId: string, id: string, data: any) {
    const row = await this.prisma.meeting.findUnique({ where: { id }, include: { relationship: { select: { sourceOrganizationId: true, targetOrganizationId: true } }, participants: true } });
    if (!row || row.deletedAt) throw new NotFoundException('Meeting not found');
    await this.assertAccess(userId, row);
    if (data.organizationId) await this.authorization.assertPermission(userId, 'meeting.write', { organizationId: data.organizationId });
    if (data.relationshipId) { const r=await this.prisma.relationship.findUnique({where:{id:data.relationshipId},select:{sourceOrganizationId:true,targetOrganizationId:true}});if(!r)throw new NotFoundException('Relationship not found');await this.authorization.assertAnyOrganizationAccess(userId,[r.sourceOrganizationId,r.targetOrganizationId]); }
    const participantIds = data.participantPersonIds !== undefined ? await this.validateParticipants(userId, data.participantPersonIds, data.relationshipId ?? row.relationshipId, data.organizationId ?? row.organizationId ?? undefined) : undefined;
    const { participantPersonIds, ...raw } = data;
    const allowed = ['title','objective','agenda','status','startAt','endAt','notes','outcome','transcript','meetingUrl','location','decisions','preMeetingBrief','recordingReference','followUpCandidates','attachments','organizationId','relationshipId'];
    const update: any = {}; for (const key of allowed) if (raw[key] !== undefined) update[key] = raw[key]; if (update.startAt) update.startAt = new Date(update.startAt); if (update.endAt !== undefined) update.endAt = update.endAt ? new Date(update.endAt) : null;
    const updated = await this.eventBus.transaction(async tx => {
      const next = await tx.meeting.update({ where: { id }, data: update });
      if (participantIds !== undefined) { await tx.meetingParticipant.deleteMany({ where: { meetingId: id } }); if (participantIds.length) await tx.meetingParticipant.createMany({ data: participantIds.map(personId => ({ meetingId: id, personId })), skipDuplicates: true }); }
      await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'Meeting', entityId: id, organizationId: next.organizationId ?? undefined, before: row, after: next }, tx);
      await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.MEETING_UPDATED, aggregateType: 'Meeting', aggregateId: next.id, organizationId: next.organizationId ?? undefined, actorId: userId, payload: next as any });
      if (row.status !== MeetingStatus.COMPLETED && next.status === MeetingStatus.COMPLETED) await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.MEETING_COMPLETED, aggregateType: 'Meeting', aggregateId: next.id, organizationId: next.organizationId ?? undefined, actorId: userId, payload: next as any });
      return next;
    });
    return this.get(userId, updated.id);
  }

  async complete(userId: string, id: string, data: any) {
    const row = await this.prisma.meeting.findUnique({ where: { id }, include: { relationship: { select: { sourceOrganizationId: true, targetOrganizationId: true } } } });
    if (!row || row.deletedAt) throw new NotFoundException('Meeting not found');
    await this.assertAccess(userId, row);
    const allowed = ['notes','outcome','decisions','transcript','preMeetingBrief']; const update:any={status:MeetingStatus.COMPLETED,completedAt:new Date()}; for(const k of allowed)if(data[k]!==undefined)update[k]=data[k];
    const updated = await this.eventBus.transaction(async tx => { const next=await tx.meeting.update({where:{id},data:update}); await this.audit.logMutation({userId,action:'UPDATE',entityType:'Meeting',entityId:id,organizationId:next.organizationId??undefined,before:row,after:next,reason:'meeting_completed'},tx); await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.MEETING_UPDATED,aggregateType:'Meeting',aggregateId:next.id,organizationId:next.organizationId??undefined,actorId:userId,payload:next as any}); await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.MEETING_COMPLETED,aggregateType:'Meeting',aggregateId:next.id,organizationId:next.organizationId??undefined,actorId:userId,payload:next as any}); return next; });
    return EntityResponseDto.from('Meeting',updated);
  }

  async replaceParticipants(userId: string, id: string, personIds: string[]) {
    const row = await this.prisma.meeting.findUnique({ where: { id }, include: { relationship: { select: { sourceOrganizationId: true, targetOrganizationId: true } } } });
    if (!row || row.deletedAt) throw new NotFoundException('Meeting not found'); await this.assertAccess(userId,row); const ids=await this.validateParticipants(userId,personIds,row.relationshipId??undefined,row.organizationId??undefined);
    await this.eventBus.transaction(async tx=>{await tx.meetingParticipant.deleteMany({where:{meetingId:id}});if(ids.length)await tx.meetingParticipant.createMany({data:ids.map(personId=>({meetingId:id,personId})),skipDuplicates:true});await this.audit.logMutation({userId,action:'UPDATE',entityType:'MeetingParticipants',entityId:id,organizationId:row.organizationId??undefined,after:{personIds:ids},reason:'replace_participants'},tx);});
    return this.get(userId,id);
  }

  async remove(userId: string, id: string) { const row=await this.prisma.meeting.findUnique({where:{id},include:{relationship:{select:{sourceOrganizationId:true,targetOrganizationId:true}}}});if(!row||row.deletedAt)throw new NotFoundException('Meeting not found');await this.assertAccess(userId,row);const archived=await this.eventBus.transaction(async tx=>{const next=await this.lifecycle.softDelete(userId,'Meeting',id,'remove',tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.MEETING_DELETED,aggregateType:'Meeting',aggregateId:next.id,organizationId:next.organizationId??undefined,actorId:userId,payload:next as any});return next;});return EntityResponseDto.fromUnknown(archived); }

  // ---------------------------------------------------------------------
  // Meeting Minutes (خروجی جلسه) + Action-Item Extraction + Follow-up
  //
  // این منطق کاملاً قطعی (deterministic) و مستقل از هر سرویس AI/بیرونی است:
  // فقط بر اساس متن notes/transcript/decisionsی که کاربر خودش ثبت می‌کند کار
  // می‌کند. هیچ فراخوانی شبکه یا مدل زبانی در این مسیر وجود ندارد.
  // ---------------------------------------------------------------------

  /**
   * خروجی رسمی جلسه (Meeting Minutes) را از داده‌های ثبت‌شده می‌سازد:
   * سرتیتر، شرکت‌کنندگان، دستور جلسه، تصمیمات، خلاصه/نتیجه، و اقدامات/تعهدات
   * باز و بسته‌ی مرتبط با همین جلسه. این همان «خروجی قابل ثبت» است که پس از
   * هر جلسه می‌توان به آن رجوع کرد یا آن را برای Follow-up استفاده کرد.
   */
  async minutes(userId: string, id: string) {
    const row = await this.fetch(userId, id);
    const actions = (row.actions ?? []) as any[];
    const commitments = (row.commitments ?? []) as any[];
    const now = new Date();
    return {
      meetingId: row.id,
      title: row.title,
      objective: row.objective ?? null,
      startAt: row.startAt,
      endAt: row.endAt,
      location: row.location ?? null,
      meetingUrl: row.meetingUrl ?? null,
      participants: (row.participants ?? []).map((p: any) => ({ personId: p.personId, name: p.person?.displayName ?? p.person?.firstName ?? p.personId })),
      agenda: row.agenda ?? null,
      preMeetingBrief: row.preMeetingBrief ?? null,
      notes: row.notes ?? null,
      decisions: row.decisions ?? [],
      outcome: row.outcome ?? null,
      transcriptAttached: !!row.transcript,
      actionItems: {
        open: actions.filter((a) => a.status === 'OPEN' || a.status === 'IN_PROGRESS'),
        overdueOpen: actions.filter((a) => (a.status === 'OPEN' || a.status === 'IN_PROGRESS') && a.dueAt && new Date(a.dueAt) < now),
        completed: actions.filter((a) => a.status === 'DONE'),
      },
      commitments: {
        open: commitments.filter((c) => c.status === 'OPEN'),
        overdue: commitments.filter((c) => c.status === 'OVERDUE'),
        fulfilled: commitments.filter((c) => c.status === 'FULFILLED'),
      },
      generatedAt: now.toISOString(),
      isFinalized: !!row.outcome,
    };
  }

  /**
   * از متن notes/transcript جلسه، کاندیدهای Action Item را با یک الگوریتم
   * قطعی و شفاف (regex/heuristic، بدون AI) استخراج می‌کند. این‌ها فقط
   * "پیشنهاد" هستند — تا وقتی کاربر آن‌ها را از طریق applyActionItems تأیید
   * نکند، هیچ رکورد Action/Commitment واقعی ساخته نمی‌شود (اصل Human
   * Approval که در سند هم برای هر پیشنهاد خودکار الزامی شده است).
   */
  extractActionItems(text: string): Array<{ text: string; suggestedTitle: string; suggestedDueAt: string; isCommitmentLike: boolean; matchedKeyword: string }> {
    if (!text || !text.trim()) return [];
    const commitmentKeywords = /(?:\b(?:commit(?:ment|s|ted)?|promise[sd]?|will send|will provide|will deliver)\b|قول|تعهد|متعهد)/i;
    // \b is ASCII-only in JS; Persian keywords are matched by bare alternates while
    // English keywords keep \b word boundaries so e.g. "will" does not match "willpower".
    const actionKeywords = /(?:\b(?:follow[ -]?up|will|must|need to|needs to|should|to do|action item|deadline|schedule|prepare|send|deliver|review)\b|باید|لازم است|پیگیری|ارسال|آماده)/i;
    const rawSentences = text
      .replace(/\r/g, '')
      .split(/(?<=[.!?؟])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 4);
    const seen = new Set<string>();
    const out: Array<{ text: string; suggestedTitle: string; suggestedDueAt: string; isCommitmentLike: boolean; matchedKeyword: string }> = [];
    for (const sentence of rawSentences) {
      if (!actionKeywords.test(sentence) && !commitmentKeywords.test(sentence)) continue;
      const key = sentence.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const isCommitmentLike = commitmentKeywords.test(sentence);
      const match = sentence.match(actionKeywords) ?? sentence.match(commitmentKeywords);
      const explicitDays = sentence.match(/(\d{1,3})\s*(روز|day|days)/i);
      const dueInDays = explicitDays ? Math.min(365, Math.max(1, Number(explicitDays[1]))) : 7;
      const suggestedDueAt = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000).toISOString();
      out.push({
        text: sentence,
        suggestedTitle: sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence,
        suggestedDueAt,
        isCommitmentLike,
        matchedKeyword: match?.[0] ?? '',
      });
      if (out.length >= 20) break;
    }
    return out;
  }

  /** استخراج کاندید Action Item از notes/transcript ذخیره‌شده‌ی همین جلسه، بدون نوشتن چیزی در دیتابیس. */
  async extractActionItemsForMeeting(userId: string, id: string) {
    const row = await this.fetch(userId, id);
    const source = [row.notes, row.transcript, row.outcome].filter(Boolean).join('\n');
    const candidates = this.extractActionItems(source);
    return { meetingId: row.id, source: source ? 'notes+transcript+outcome' : 'none', candidateCount: candidates.length, candidates };
  }

  /**
   * کاندیدهای تأییدشده توسط کاربر را به رکورد واقعی Action یا Commitment
   * تبدیل می‌کند و آن‌ها را به همین جلسه و در صورت وجود به رابطه مرتبط
   * وصل می‌کند تا Follow-up ممکن شود.
   */
  async applyActionItems(userId: string, id: string, items: Array<{ title: string; dueAt?: string; asCommitment?: boolean; ownerId?: string; priority?: string; description?: string }>) {
    const row = await this.fetch(userId, id);
    if (!items?.length) return { created: [] as any[] };
    const created: any[] = [];
    for (const item of items) {
      if (!item.title?.trim()) continue;
      if (item.asCommitment) {
        const commitment = await this.eventBus.transaction(async tx => { const createdCommitment=await tx.commitment.create({data:{description:item.description??item.title,status:'OPEN',dueAt:item.dueAt?new Date(item.dueAt):undefined,ownerId:item.ownerId??row.ownerId,meetingId:row.id,relationshipId:row.relationshipId??undefined,organizationId:row.organizationId??undefined}});await this.audit.logMutation({userId,action:'CREATE',entityType:'Commitment',entityId:createdCommitment.id,organizationId:row.organizationId??undefined,after:createdCommitment,reason:'meeting_follow_up_apply'},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.COMMITMENT_CREATED,aggregateType:'Commitment',aggregateId:createdCommitment.id,organizationId:(createdCommitment as any).organizationId??undefined,actorId:userId,payload:createdCommitment as any});return createdCommitment; });
        created.push({ type: 'Commitment', record: commitment });
      } else {
        const action = await this.eventBus.transaction(async tx => { const createdAction=await tx.action.create({data:{title:item.title,status:'OPEN',priority:(item.priority as any)??'MEDIUM',dueAt:item.dueAt?new Date(item.dueAt):undefined,ownerId:item.ownerId??row.ownerId,createdById:userId,meetingId:row.id,relationshipId:row.relationshipId??undefined,organizationId:row.organizationId??undefined}});await this.audit.logMutation({userId,action:'CREATE',entityType:'Action',entityId:createdAction.id,organizationId:row.organizationId??undefined,after:createdAction,reason:'meeting_follow_up_apply'},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.ACTION_CREATED,aggregateType:'Action',aggregateId:createdAction.id,organizationId:(createdAction as any).organizationId??undefined,actorId:userId,payload:createdAction as any});return createdAction; });
        created.push({ type: 'Action', record: action });
      }
    }
    return { created };
  }

  /**
   * نهایی‌سازی جلسه: notes/outcome/decisions/transcript را ذخیره و در یک
   * فراخوانی، همان‌جا کاندیدهای Follow-up را هم برمی‌گرداند تا کاربر بلافاصله
   * تصمیم بگیرد کدام‌ها را به Action/Commitment واقعی تبدیل کند. این معادل
   * «ثبت جلسه → گرفتن خروجی → آماده برای Follow-up» است که خواسته بودید.
   */
  async finalize(userId: string, id: string, data: { notes?: string; outcome?: string; decisions?: any; transcript?: string }) {
    const updated = await this.complete(userId, id, data);
    const minutes = await this.minutes(userId, id);
    const followUpCandidates = await this.extractActionItemsForMeeting(userId, id);
    return { meeting: updated, minutes, followUpCandidates: followUpCandidates.candidates };
  }

  /**
   * فهرست پیگیری (Follow-up) کل جلسات کاربر: هر Action/Commitment باز یا
   * عقب‌افتاده‌ی مرتبط با جلسه‌ای که مالک/شرکت‌کننده‌اش کاربر است.
   */
  async followUps(userId: string, dueWithinDays = 14) {    const ids = await this.authorization.accessibleOrganizationIds(userId);
    const horizon = new Date(Date.now() + dueWithinDays * 24 * 60 * 60 * 1000);
    const scope = ids ? { OR: [{ ownerId: userId }, { meeting: { organizationId: { in: ids } } }, { relationship: { OR: [{ sourceOrganizationId: { in: ids } }, { targetOrganizationId: { in: ids } }] } }] } : { ownerId: userId };
    const [actionsOverdue, actionsDueSoon, commitmentsOverdue, commitmentsDueSoon] = await Promise.all([
      this.prisma.action.findMany({ where: { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { lt: new Date() }, meetingId: { not: null }, ...scope }, include: { meeting: true }, orderBy: { dueAt: 'asc' }, take: 100 }),
      this.prisma.action.findMany({ where: { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { gte: new Date(), lte: horizon }, meetingId: { not: null }, ...scope }, include: { meeting: true }, orderBy: { dueAt: 'asc' }, take: 100 }),
      this.prisma.commitment.findMany({ where: { deletedAt: null, status: 'OVERDUE', meetingId: { not: null }, ...scope }, include: { meeting: true }, orderBy: { dueAt: 'asc' }, take: 100 }),
      this.prisma.commitment.findMany({ where: { deletedAt: null, status: 'OPEN', dueAt: { gte: new Date(), lte: horizon }, meetingId: { not: null }, ...scope }, include: { meeting: true }, orderBy: { dueAt: 'asc' }, take: 100 }),
    ]);
    return { actionsOverdue, actionsDueSoon, commitmentsOverdue, commitmentsDueSoon, generatedAt: new Date().toISOString() };
  }

  /**
   * نسخه داخلی/سیستمی extractActionItemsForMeeting که برای Job پس‌زمینه
   * استفاده می‌شود (بدون بررسی مجوز کاربر خاص، چون از مسیر کاربری فراخوانی
   * نمی‌شود بلکه توسط Worker داخلی، پس از این‌که کاربر خودش جلسه را نهایی
   * کرده، اجرا می‌شود). نتیجه در فیلد Meeting.followUpCandidates ذخیره
   * می‌شود تا بدون محاسبه مجدد در هر Read، در دسترس باشد.
   */
  async regenerateFollowUpCandidates(meetingId: string) {
    const row = await this.prisma.meeting.findUnique({ where: { id: meetingId }, select: { id: true, notes: true, transcript: true, outcome: true, deletedAt: true } });
    if (!row || row.deletedAt) return { meetingId, skipped: true, reason: 'meeting not found or archived' };
    const source = [row.notes, row.transcript, row.outcome].filter(Boolean).join('\n');
    const candidates = this.extractActionItems(source);
    await this.prisma.meeting.update({ where: { id: meetingId }, data: { followUpCandidates: candidates as any } });
    return { meetingId, candidateCount: candidates.length };
  }
}
