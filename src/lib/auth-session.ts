import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from './auth-session-shared';
import { verifyAccessToken } from './auth-token.server';
import type { AuthenticatedUser } from '@/features/auth/types';

export async function getServerSession(): Promise<AuthenticatedUser | null> {
  const store = await cookies();
  return verifyAccessToken(store.get(AUTH_COOKIE_NAME)?.value);
}