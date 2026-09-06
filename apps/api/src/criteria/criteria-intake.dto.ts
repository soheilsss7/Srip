import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CriteriaAnswerMethod } from '@prisma/client';

/**
 * پاسخ یک پرسش از کاتالوگ معیارها — همان ساختاری که پرسش‌نامای لحظۀ ساخت رکورد
 * (سازمان/شخص/رابطه) می‌فرستد و همان چیزی که امتیاز معیارمحور از آن ساخته می‌شود.
 * همه‌چیز اختیاری است؛ «پاسخ ندادن» با «صفر» یکسان نیست و در engine هم همین‌طور رفتار می‌شود.
 */
export class CriteriaIntakeAnswerDto {
  @IsString() @MaxLength(64) criterionCode!: string;
  @IsInt() @Min(0) @Max(5) @IsOptional() level?: number;
  @IsNumber() @Min(0) @Max(100) @IsOptional() value?: number;
  @IsString() @MaxLength(2000) @IsOptional() note?: string;
  @IsString() @MaxLength(1000) @IsOptional() evidence?: string;
  @IsEnum(CriteriaAnswerMethod) @IsOptional() method?: CriteriaAnswerMethod;
  @IsString() @IsOptional() answeredAt?: string;
}

/** فیلد مشترک در DTOهای ساخت رکورد. */
export class CriteriaIntakeDto {
  @IsArray() @IsOptional() @ArrayMaxSize(80) @ValidateNested({ each: true }) @Type(() => CriteriaIntakeAnswerDto)
  criteriaAnswers?: CriteriaIntakeAnswerDto[];
}
