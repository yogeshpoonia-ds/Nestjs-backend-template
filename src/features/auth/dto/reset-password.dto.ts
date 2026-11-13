import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from the password reset email' })
  @IsString({ message: i18nValidationMessage('validation.REQUIRED') })
  @MinLength(1, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(256, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  token!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString({ message: i18nValidationMessage('validation.REQUIRED') })
  @MinLength(8, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(128, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  newPassword!: string;
}
