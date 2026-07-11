// Which environment this build is running as ("development" or "production"),
// selected via the .env.development / .env.production files Expo loads by mode.
// Useful for env-specific behaviour or an on-screen dev badge.
export const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? "development";
export const IS_DEV = APP_ENV !== "production";

// Wisdom groups — the top-level bucket an entry belongs to. `Generic` is used
// for the seeded cold-start entries; the rest are user-facing categories.
export const GROUPS = ["Personal", "Work", "Generic", "Ideas", "Learning"] as const;
export type Group = (typeof GROUPS)[number];
export const DEFAULT_GROUP: Group = "Personal";

// Starter questions answerable from the seeded generic wisdom, so a user can
// ask something useful immediately — before writing any entries of their own.
export const STARTER_QUESTIONS = [
  "How should I approach a big, hard decision?",
  "How do I build a habit that actually sticks?",
  "What's the fastest way to learn something new?",
  "How should I think about money over the long term?",
  "How can I focus better and avoid distraction?",
  "How do I bounce back after a failure?",
  "How do I tell what's important from what's just urgent?",
  "How can I stay calm when I'm stressed?",
];

// Parse a free-text tag field ("focus, habits") into a clean string array.
export function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}
