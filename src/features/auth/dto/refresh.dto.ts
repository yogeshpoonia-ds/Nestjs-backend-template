import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

/** Mobile sends the refresh token in the body; cookie surfaces omit the body. */
export class RefreshDto {
  @ApiPropertyOptional({
    description:
      'Refresh token (required on mobile, ignored on cookie surfaces)',
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.REQUIRED') })
  @MaxLength(512, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  refreshToken?: string;
}
