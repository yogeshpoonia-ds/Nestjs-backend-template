import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Valid Argon2id hash (same parameters as real hashes) of a throwaway value.
 * Verified against when a user does not exist so login timing does not reveal
 * whether an email is registered.
 */
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$ginJHunaAo6GZI2aZk2ceg$/dlSy6Wbwi3rZB0fh/tg3VfLG5LmGf0qUxlz/KYzuHE';

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
