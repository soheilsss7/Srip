/* ============================================================================
   prisma.config.ts — پیکربندی CLI پراسیما (پلن یکپارچه‌سازی، فاز ۱/ADR-0010)
   ----------------------------------------------------------------------------
   چرا این فایل وجود دارد:
   - محیط‌های بدون دسترسی به binaries.prisma.sh (سندباکس/آفلاین) نمی‌توانند
     باینری native موتور schema را دانلود کنند. با PRISMA_JS_ENGINE=1 همان
     موتور WASMِ داخل node_modules استفاده می‌شود (بدون دانلود).
   - رفتار پیش‌فرض (CI و توسعهٔ عادی با شبکه) دست‌نخورده می‌ماند: بدون این
     متغیر، config موتور/دیتاسورسی تعیین نمی‌کند و CLI مثل قبل کار می‌کند.
  ----------------------------------------------------------------------------
   استفادهٔ آفلاین:  PRISMA_JS_ENGINE=1 pnpm prisma:generate
   استفادهٔ عادی:    pnpm prisma:generate   (مثل همیشه — دانلود native)
   ========================================================================== */
import 'dotenv/config';
import { defineConfig } from '@prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

const useJsEngine = process.env.PRISMA_JS_ENGINE === '1';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(useJsEngine
    ? {
        experimental: { adapter: true },
        engine: 'js' as const,
        adapter: async () =>
          new PrismaPg({
            connectionString:
              process.env.DATABASE_URL ?? 'postgresql://localhost:5432/srip?schema=public',
          }) as never,
      }
    : {}),
});
