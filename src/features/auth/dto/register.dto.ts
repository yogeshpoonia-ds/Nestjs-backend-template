import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { normalizeEmail } from '../utils/email.util.js';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail({}, { message: i18nValidationMessage('validation.INVALID_EMAIL') })
  @MaxLength(254, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString({ message: i18nValidationMessage('validation.REQUIRED') })
  @MinLength(8, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(128, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  password!: string;

  @ApiProperty({ example: 'Jane Doe', minLength: 1, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: i18nValidationMessage('validation.REQUIRED') })
  @MinLength(1, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(100, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  name!: string;

  @ApiPropertyOptional({ example: 'iPhone 15', maxLength: 100 })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.REQUIRED') })
  @MaxLength(100, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  deviceName?: string;
}
