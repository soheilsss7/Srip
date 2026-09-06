# Phase 37 — Production Observability / Monitoring

## Scope
این Phase بخش‌های Observability/Monitoring سند اصلی را پوشش می‌دهد: Application Logs، Error Tracking، Metrics، Tracing، API Latency، DB Latency، Queue Monitoring، AI Latency/Cost، User Activity و Dashboard-oriented monitoring شامل CPU/Memory/DB/Redis/API/Queue/Storage/Error Rate/Response Time/Availability.

## Tracing
- W3C `traceparent` برای inbound HTTP پذیرفته و در response بازتاب داده می‌شود.
- برای هر request یک root trace ساخته می‌شود.
- `AsyncLocalStorage` context را در async path نگه می‌دارد.
- outbound `fetch` به‌صورت مرکزی traceparent را propagate و client span ایجاد می‌کند.
- BullMQ job payload، `traceparent` را carry می‌کند و worker consumer span می‌سازد.
- Prisma query duration به DB span/metric تبدیل می‌شود.
- OTLP/HTTP exporter با `OTEL_EXPORTER_OTLP_ENDPOINT` فعال می‌شود.

## Error tracking
`SENTRY_DSN` در صورت تنظیم، exceptionهای HTTP 5xx را با event id، stack trace، environment، release، request/correlation id، user id و trace id به Sentry-compatible Store ارسال می‌کند. اگر DSN تنظیم نشده باشد، application بدون dependency خارجی اجرا می‌شود.

## Metrics
`GET /api/v1/metrics` خروجی Prometheus می‌دهد و علاوه بر counters قبلی شامل histogramهای API/DB، queue gauges، storage counters، AI latency/token/cost و availability است.

## Queue monitoring
تمام Queueهای BullMQ هر 15 ثانیه (قابل تنظیم) count می‌شوند و در `/api/v1/observability/queue` و Prometheus منتشر می‌شوند.

## Health / availability
`/api/v1/health` و `/api/v1/health/ready` اکنون DB، Redis، Queue و Storage configuration را گزارش می‌کنند و availability samples را به Metrics اضافه می‌کنند.

## Runtime configuration
- `OTEL_TRACING_ENABLED`
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`
- `QUEUE_METRICS_INTERVAL_MS`

## Production note
برای Production واقعی باید OTLP Collector/Backend و Sentry DSN واقعی تنظیم شود. Static validation این repository این wiring را بررسی می‌کند؛ اتصال به سرویس‌های خارجی فقط در محیط Runtime واقعی قابل PASS است.
