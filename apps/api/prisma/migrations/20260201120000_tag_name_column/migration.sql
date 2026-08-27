-- Tag.name was referenced by a UNIQUE constraint in phase2 before its column
-- existed anywhere in the historical chain; this adds the column exactly as
-- prisma/schema.prisma models it (name String @unique) right after phase2,
-- preserving the original constraint name and timing semantics.
ALTER TABLE "Tag" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'unnamed';
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
