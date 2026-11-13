import type { AuthResult } from '../auth.service.js';
import type { AccessTokenResponseDto } from '../dto/auth-response.dto.js';

export function toAccessTokenResponse(
  result: AuthResult,
  extras: { csrfToken?: string; includeRefreshToken?: boolean } = {},
): AccessTokenResponseDto {
  return {
    accessToken: result.accessToken,
    tokenType: 'Bearer',
    expiresIn: result.accessTokenExpiresIn,
    user: result.user,
    ...(extras.csrfToken !== undefined ? { csrfToken: extras.csrfToken } : {}),
    ...(extras.includeRefreshToken === true
      ? { refreshToken: result.refreshToken }
      : {}),
  };
}
