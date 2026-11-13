import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateRoleDto {
  @ApiProperty({ example: 'project_manager' })
  @IsString({ message: i18nValidationMessage('validation.REQUIRED') })
  @MinLength(2)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: 'Project Manager' })
  @IsString({ message: i18nValidationMessage('validation.REQUIRED') })
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ example: 'Manages project resources' })
  @IsString({ message: i18nValidationMessage('validation.REQUIRED') })
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}
