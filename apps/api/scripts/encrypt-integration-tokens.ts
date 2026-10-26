import { PrismaClient } from '@prisma/client';
import { SecretEncryptionService } from '../src/common/security/secret-encryption.service';

async function main() {
  const prisma = new PrismaClient();
  const encryption = new SecretEncryptionService();
  let scanned = 0;
  let encrypted = 0;
  try {
    const rows = await prisma.integrationConnection.findMany({
      where: { OR: [{ accessTokenEncrypted: { not: null } }, { refreshTokenEncrypted: { not: null } }] },
      select: { id: true, accessTokenEncrypted: true, refreshTokenEncrypted: true },
    });
    for (const row of rows) {
      scanned++;
      const data: { accessTokenEncrypted?: string | null; refreshTokenEncrypted?: string | null } = {};
      if (row.accessTokenEncrypted && !encryption.isEncrypted(row.accessTokenEncrypted)) data.accessTokenEncrypted = encryption.encrypt(row.accessTokenEncrypted);
      if (row.refreshTokenEncrypted && !encryption.isEncrypted(row.refreshTokenEncrypted)) data.refreshTokenEncrypted = encryption.encrypt(row.refreshTokenEncrypted);
      if (!Object.keys(data).length) continue;
      await prisma.$transaction(async tx => {
        await tx.integrationConnection.update({ where: { id: row.id }, data });
        await tx.auditLog.create({
          data: {
            action: 'TOKEN_CHANGE', entityType: 'IntegrationConnection', entityId: row.id,
            after: { credentialsEncrypted: true, keyVersion: process.env.SECRET_ENCRYPTION_KEY_VERSION || 'v1' },
            reason: 'phase-o-plaintext-token-migration',
          },
        });
      });
      encrypted++;
    }
    console.log(`Integration token encryption migration complete: scanned=${scanned}, encrypted=${encrypted}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Migration failed'); process.exit(1); });
