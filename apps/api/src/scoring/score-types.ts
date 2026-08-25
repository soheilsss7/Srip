export type ScoreSubjectType = 'RELATIONSHIP' | 'OPPORTUNITY' | 'RISK' | 'CONNECTOR' | 'NETWORK';

export type ScoreResult = {
  score: number;
  version: number;
  versionId?: string;
  type: ScoreSubjectType;
  subjectType: string;
  subjectId: string;
  explanation: string;
  factors: Record<string, number | string | boolean | null>;
};
