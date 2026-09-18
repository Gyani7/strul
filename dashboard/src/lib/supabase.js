'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://umthaxqbsqijuuhsdvqc.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_8YoKXkChlkmIHLS428C__A_vKz8wZuZ';

let supabaseClient = null;

function createSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase configuration is missing.'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseClient;
}

export const supabase = new Proxy(
  {},
  {
    get(_target, property) {
      const client = createSupabaseClient();
      return client[property];
    },
  }
);

export async function signUp(email, password, displayName) {
  const { data, error } = await createSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } =
    await createSupabaseClient().auth.signInWithPassword({
      email,
      password,
    });

  return { data, error };
}

export async function signOut() {
  return await createSupabaseClient().auth.signOut();
}

export async function getSession() {
  const {
    data: { session },
  } = await createSupabaseClient().auth.getSession();

  return session;
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await createSupabaseClient().auth.getUser();

  return user;
}
