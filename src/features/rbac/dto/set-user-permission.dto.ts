import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional } from 'class-validator';
import { PermissionEffect } from '../../../generated/prisma/enums.js';

export class SetUserPermissionDto {
  @ApiProperty({ enum: PermissionEffect })
  @IsEnum(PermissionEffect)
  effect!: PermissionEffect;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}
