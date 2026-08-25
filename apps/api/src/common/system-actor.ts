/**
 * شناسه کاربر سیستمی (System Actor).
 *
 * برخی عملیات (مثل جاروب خودکار تعهدات عقب‌افتاده یا محاسبه دوره‌ای
 * Analytics) توسط یک Cron Job اجرا می‌شوند، نه یک کاربر انسانی. برای این‌که
 * Audit Log هنوز یک Actor معتبر و قابل ردیابی داشته باشد (به‌جای گذاشتن
 * userId خالی یا یک مقدار جعلی که Foreign Key دیتابیس را می‌شکند)، یک
 * رکورد واقعی User با همین شناسه‌ی ثابت در دیتابیس seed/migrate می‌شود.
 *
 * این کاربر:
 *  - isActive=false است (هرگز نمی‌تواند از طریق Login وارد شود)
 *  - passwordHash ندارد
 *  - فقط برای ارجاع Foreign Key در AuditLog/Notification استفاده می‌شود
 */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000099';
export const SYSTEM_USER_EMAIL = 'system@srip.internal';
export const SYSTEM_USER_NAME = 'SRIP Scheduled Jobs';
