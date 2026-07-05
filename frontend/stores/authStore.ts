import { create } from "zustand";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// Deep link the confirmation email should send the user back to (e.g.
// `wisdombase://` in a build, or the Expo Go dev URL). Passing this explicitly
// stops Supabase from falling back to the dashboard "Site URL". This URL must
// also be added to Supabase → Authentication → URL Configuration → Redirect URLs.
//
// For web deployments, use the actual web URL; for native apps, use the deep link.
const getEmailRedirectUrl = () => {
  // Check if running on web
  if (typeof window !== "undefined" && window.location) {
    // In production web, use the actual domain
    const origin = window.location.origin;
    // Only use the web URL if it's not localhost
    if (!origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      return `${origin}/(auth)/email-verified`;
    }
  }
  // For native apps or local development, use the deep link
  return Linking.createURL("/");
};

const emailRedirectTo = getEmailRedirectUrl();

type AuthState = {
  session: Session | null;
  initializing: boolean;
  init: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, phone?: string) => Promise<void>;
  // One-time-code (passwordless) auth.
  sendEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  session: null,
  initializing: true,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, initializing: false });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },

  signUp: async (email, password, phone) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        // Capture the mobile number now (stored as user metadata) so phone login
        // can be enabled later once an SMS provider is configured.
        ...(phone ? { data: { phone } } : {}),
      },
    });
    if (error) throw new Error(error.message);
  },

  sendEmailOtp: async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo },
    });
    if (error) throw new Error(error.message);
  },

  verifyEmailOtp: async (email, token) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw new Error(error.message);
  },

  sendPhoneOtp: async (phone) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw new Error(error.message);
  },

  verifyPhoneOtp: async (phone, token) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    if (error) throw new Error(error.message);
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    set({ session: null });
  },
}));
