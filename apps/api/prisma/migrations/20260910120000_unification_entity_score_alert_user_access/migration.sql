-- فازهای ۲/۳/۴ پلن یکپارچه‌سازی (ADR-0006/0007/0008):
-- EntityScore: امتیاز مرکب واحد برای همهٔ دامنه‌ها
-- Alert: هشدار یکپارچهٔ همهٔ ماژول‌ها
-- UserAccess: RBAC سه‌بعدی scope × accessLevel × functionalRole

-- EntityScore (فاز ۲ — ADR-0006)
CREATE TYPE "EntityScoreType" AS ENUM ('RELATIONSHIP','PUBLIC_GROUP','PUBLIC_MEMBER');

CREATE TABLE "EntityScore" (
    "id" TEXT NOT NULL,
    "entityType" "EntityScoreType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "composite" DOUBLE PRECISION NOT NULL,
    "factors" JSONB NOT NULL,
    "formulaVersion" TEXT NOT NULL,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EntityScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EntityScore_entityType_entityId_key" ON "EntityScore"("entityType","entityId");
CREATE INDEX "EntityScore_entityType_composite_idx" ON "EntityScore"("entityType","composite");

-- Alert (فاز ۳ — ADR-0007)
CREATE TYPE "AlertModule" AS ENUM ('RELATIONSHIP','PUBLICS','ACTION','COMMITMENT','MEETING','WORKFLOW','DATA_QUALITY','SECURITY','MONITORING');
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL','WARNING','INFO');

CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "module" "AlertModule" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Alert_module_severity_resolvedAt_idx" ON "Alert"("module","severity","resolvedAt");
CREATE INDEX "Alert_entityType_entityId_idx" ON "Alert"("entityType","entityId");

-- UserAccess (فاز ۴ — ADR-0008)
CREATE TYPE "ScopeType" AS ENUM ('ALL','ORGANIZATION');
CREATE TYPE "AccessLevel" AS ENUM ('ADMIN','EXECUTIVE','STANDARD','READ_ONLY');
CREATE TYPE "FunctionalRole" AS ENUM ('RELATIONSHIP_MANAGER','PROJECT_MANAGER','ANALYST');

CREATE TABLE "UserAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "ScopeType" NOT NULL DEFAULT 'ORGANIZATION',
    "scopeOrgIds" TEXT[],
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'STANDARD',
    "functionalRole" "FunctionalRole",
    "permissionOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserAccess_userId_key" ON "UserAccess"("userId");
CREATE INDEX "UserAccess_accessLevel_idx" ON "UserAccess"("accessLevel");
CREATE INDEX "UserAccess_scope_idx" ON "UserAccess"("scope");
ALTER TABLE "UserAccess" ADD CONSTRAINT "UserAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
