export const QUEUE_NAMES = {
  default: 'srip-default',
  notifications: 'srip-notifications',
  ai: 'srip-ai',
  meetings: 'srip-meetings',
  documents: 'srip-documents',
  recommendations: 'srip-recommendations',
  search: 'srip-search',
  integrations: 'srip-integrations',
  analytics: 'srip-analytics',
  reminders: 'srip-reminders',
  maintenance: 'srip-maintenance',
  dataImports: 'srip-data-imports',
  privacyExports: 'srip-privacy-exports',
  deadLetter: 'srip-dead-letter',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  notificationDispatch: 'notifications.dispatch',
  aiProcess: 'ai.process',
  meetingTranscribe: 'meetings.transcribe',
  documentProcess: 'documents.process',
  recommendationGenerate: 'recommendations.generate',
  searchReindex: 'search.reindex',
  integrationSync: 'integrations.sync',
  analyticsRecompute: 'analytics.recompute',
  reminderDispatch: 'reminders.dispatch',
  overdueSweep: 'commitments.overdue-sweep',
  domainEventsDispatch: 'domain-events.dispatch',
  dataImportProcess: 'data-import.process',
  privacyExportProcess: 'privacy-export.process',
} as const;

export type JobName = typeof JOB_NAMES[keyof typeof JOB_NAMES];

export const JOB_QUEUE: Record<JobName, QueueName> = {
  [JOB_NAMES.notificationDispatch]: QUEUE_NAMES.notifications,
  [JOB_NAMES.aiProcess]: QUEUE_NAMES.ai,
  [JOB_NAMES.meetingTranscribe]: QUEUE_NAMES.meetings,
  [JOB_NAMES.documentProcess]: QUEUE_NAMES.documents,
  [JOB_NAMES.recommendationGenerate]: QUEUE_NAMES.recommendations,
  [JOB_NAMES.searchReindex]: QUEUE_NAMES.search,
  [JOB_NAMES.integrationSync]: QUEUE_NAMES.integrations,
  [JOB_NAMES.analyticsRecompute]: QUEUE_NAMES.analytics,
  [JOB_NAMES.reminderDispatch]: QUEUE_NAMES.reminders,
  [JOB_NAMES.overdueSweep]: QUEUE_NAMES.maintenance,
  [JOB_NAMES.domainEventsDispatch]: QUEUE_NAMES.default,
  [JOB_NAMES.dataImportProcess]: QUEUE_NAMES.dataImports,
  [JOB_NAMES.privacyExportProcess]: QUEUE_NAMES.privacyExports,
};
