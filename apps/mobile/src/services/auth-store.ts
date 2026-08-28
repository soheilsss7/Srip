import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'srip.access_token';
const REFRESH_KEY = 'srip.refresh_token';
const SCOPE_KEY = 'srip.scope';

export type StoredTokens = { accessToken: string; refreshToken: string | null };

export async function getStoredTokens(): Promise<StoredTokens | null> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
  if (!accessToken) return null;
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  return { accessToken, refreshToken };
}

export async function getStoredScope(): Promise<string | null> {
  return SecureStore.getItemAsync(SCOPE_KEY);
}

export async function setStoredTokens(accessToken: string, refreshToken?: string | null) {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}

export async function setStoredScope(scope: string) {
  await SecureStore.setItemAsync(SCOPE_KEY, scope);
}

export async function clearStoredTokens() {
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
}