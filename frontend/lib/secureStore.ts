// LLM provider API keys live on-device only: iOS Keychain via expo-secure-store
// on native, browser localStorage on web. Keys are sent per-request to the
// backend and never persisted on our servers.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const isWeb = Platform.OS === "web";
const LEGACY_KEY = "anthropic_api_key"; // single-key format from before multi-provider
const PROVIDERS_KEY = "llm_provider_keys";

export type ProviderId = "anthropic" | "openai" | "google";

// A saved key. Order within the stored array IS the priority order.
export type ProviderKey = { provider: ProviderId; apiKey: string };

export const PROVIDERS: {
  id: ProviderId;
  label: string;
  getKeyUrl: string;
  placeholder: string;
}[] = [
  { id: "anthropic", label: "Anthropic · Claude", getKeyUrl: "console.anthropic.com", placeholder: "sk-ant-…" },
  { id: "openai", label: "OpenAI · GPT", getKeyUrl: "platform.openai.com/api-keys", placeholder: "sk-…" },
  { id: "google", label: "Google · Gemini", getKeyUrl: "aistudio.google.com/app/apikey", placeholder: "AIza…" },
];

// ---- low-level storage (web/native) ----------------------------------------
async function getItem(key: string): Promise<string | null> {
  if (isWeb) return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  return SecureStore.getItemAsync(key);
}
async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

const validProvider = (p: unknown): p is ProviderId =>
  p === "anthropic" || p === "openai" || p === "google";

// ---- provider key management -----------------------------------------------
export async function getProviderKeys(): Promise<ProviderKey[]> {
  const raw = await getItem(PROVIDERS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((p) => p && validProvider(p.provider) && typeof p.apiKey === "string" && p.apiKey)
          .map((p) => ({ provider: p.provider as ProviderId, apiKey: p.apiKey }));
      }
    } catch {
      /* fall through to legacy migration */
    }
  }

  // Migrate the legacy single Anthropic key into the new list, once.
  const legacy = await getItem(LEGACY_KEY);
  if (legacy) {
    const migrated: ProviderKey[] = [{ provider: "anthropic", apiKey: legacy }];
    await setProviderKeys(migrated);
    await deleteItem(LEGACY_KEY);
    return migrated;
  }
  return [];
}

export async function setProviderKeys(keys: ProviderKey[]): Promise<void> {
  const clean = keys
    .map((k) => ({ provider: k.provider, apiKey: k.apiKey.trim() }))
    .filter((k) => validProvider(k.provider) && k.apiKey);
  await setItem(PROVIDERS_KEY, JSON.stringify(clean));
}

// ---- legacy helper kept for any remaining single-key callers ----------------
export async function getApiKey(): Promise<string | null> {
  const keys = await getProviderKeys();
  return keys.find((k) => k.provider === "anthropic")?.apiKey ?? null;
}
