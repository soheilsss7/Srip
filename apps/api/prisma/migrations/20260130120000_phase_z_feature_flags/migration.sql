ALTER TABLE "FeatureFlag"
  ADD COLUMN "rolloutOrganizationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "rolloutUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "FeatureFlag_enabled_rollout_idx"
  ON "FeatureFlag"("enabled", "rollout");
