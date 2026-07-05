// Backend API calls. Every request carries the Supabase access token.
import { Platform } from "react-native";
import { supabase } from "./supabase";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export type Source = {
  entry_id: string;
  title: string;
  snippet: string;
  date: string;
};

export type Entry = {
  id: string;
  title: string | null;
  content: string;
  source: string;
  group_name?: string | null;
  tags?: string[] | null;
  created_at: string;
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export function ingest(input: {
  title?: string;
  content: string;
  source?: string;
  group?: string;
  tags?: string[];
  created_at?: string;
}): Promise<{ entry_id: string; chunk_count: number }> {
  return request("/ingest", { method: "POST", body: JSON.stringify(input) });
}

export type Usage = {
  free_limit: number;
  free_used: number;
  free_remaining: number;
  used_free_key?: boolean;
  has_own_key?: boolean;
};

export function query(input: {
  question: string;
  providers?: { provider: string; apiKey: string }[];
  api_key?: string | null;
  history?: { role: string; content: string }[];
}): Promise<{ answer: string; sources: Source[]; usage?: Usage }> {
  const { providers, ...rest } = input;
  return request("/query", {
    method: "POST",
    body: JSON.stringify({
      ...rest,
      // backend expects api_key (snake_case) per provider, in priority order
      providers: (providers ?? []).map((p) => ({ provider: p.provider, api_key: p.apiKey })),
    }),
  });
}

export function getUsage(): Promise<Usage> {
  return request("/usage", { method: "GET" });
}

export type LinkResult = {
  url: string;
  ok: boolean;
  entry_id?: string;
  title?: string | null;
  error?: string;
};

export function ingestUrls(input: {
  urls: string[];
  group?: string;
  tags?: string[];
}): Promise<{ results: LinkResult[]; succeeded: number; failed: number }> {
  return request("/ingest-urls", { method: "POST", body: JSON.stringify(input) });
}

export type FileResult = {
  filename: string;
  ok: boolean;
  entry_id?: string;
  title?: string | null;
  error?: string;
};

export type PickedFile = { uri: string; name: string; mimeType?: string };

export async function ingestFiles(input: {
  assets: PickedFile[];
  group?: string;
  tags?: string[];
}): Promise<{ results: FileResult[]; succeeded: number; failed: number }> {
  const form = new FormData();
  for (const a of input.assets) {
    if (Platform.OS === "web") {
      // On web the picked uri is a blob: URL — turn it into a real Blob to upload.
      const blob = await (await fetch(a.uri)).blob();
      form.append("files", blob, a.name);
    } else {
      // React Native accepts a {uri,name,type} file part directly.
      // @ts-expect-error RN FormData file part shape
      form.append("files", { uri: a.uri, name: a.name, type: a.mimeType || "application/octet-stream" });
    }
  }
  if (input.group) form.append("group", input.group);
  if (input.tags?.length) form.append("tags", input.tags.join(","));

  // Note: do NOT set Content-Type — the runtime adds the multipart boundary.
  const res = await fetch(`${BASE}/ingest-files`, {
    method: "POST",
    headers: { ...(await authHeader()) },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`);
  return body as { results: FileResult[]; succeeded: number; failed: number };
}

export function fetchEntries(): Promise<{ entries: Entry[] }> {
  return request("/entries", { method: "GET" });
}

export function seedGeneric(): Promise<{ seeded: number; already_seeded: boolean }> {
  return request("/seed-generic", { method: "POST" });
}

export function getMemory(): Promise<{ profile: string }> {
  return request("/memory", { method: "GET" });
}

export function refreshMemory(input: {
  providers?: { provider: string; apiKey: string }[];
  api_key?: string | null;
}): Promise<{ profile: string; updated: boolean; detail?: string }> {
  const { providers, ...rest } = input;
  return request("/memory/refresh", {
    method: "POST",
    body: JSON.stringify({
      ...rest,
      providers: (providers ?? []).map((p) => ({ provider: p.provider, api_key: p.apiKey })),
    }),
  });
}

export function fetchEntry(entryId: string): Promise<Entry> {
  return request(`/entries/${entryId}`, { method: "GET" });
}

export function deleteEntries(entryIds: string[]): Promise<{ deleted: number }> {
  return request("/entries/delete", {
    method: "POST",
    body: JSON.stringify({ entry_ids: entryIds }),
  });
}

export function deleteAccount(): Promise<{
  deleted: boolean;
  message: string;
  email_sent: boolean;
}> {
  return request("/account/delete", { method: "POST" });
}
