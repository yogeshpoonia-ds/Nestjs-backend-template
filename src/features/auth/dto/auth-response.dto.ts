import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;
}

export class AccessTokenResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ description: 'Access token lifetime in seconds' })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiPropertyOptional({
    description:
      'CSRF token (also set as the csrf_token cookie); send it as X-CSRF-Token on refresh',
  })
  csrfToken?: string;

  @ApiPropertyOptional({
    description: 'Refresh token. Returned in the body on mobile only.',
  })
  refreshToken?: string;
}

export class SessionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['admin', 'web', 'mobile'] })
  surface!: 'admin' | 'web' | 'mobile';

  @ApiProperty({ nullable: true, type: String })
  userAgent!: string | null;

  @ApiProperty({ nullable: true, type: String })
  ipAddress!: string | null;

  @ApiProperty({ nullable: true, type: String })
  deviceName!: string | null;

  @ApiProperty()
  lastActivityAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  expiresAt!: Date;

  @ApiPropertyOptional()
  isCurrent?: boolean;
}

export class ProfileDto extends AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ enum: ['admin', 'web', 'mobile'] })
  surface!: 'admin' | 'web' | 'mobile';
}

export class AcceptedResponseDto {
  @ApiProperty({ example: true })
  accepted!: boolean;
}
