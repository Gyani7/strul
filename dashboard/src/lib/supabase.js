'use client';

import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;

function getSupabaseClient() {
if (supabaseInstance) {
return supabaseInstance;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
throw new Error(
'Supabase configuration is missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
);
}

supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
auth: {
persistSession: true,
autoRefreshToken: true,
detectSessionInUrl: true,
},
});

return supabaseInstance;
}

/*

* Backward-compatible Supabase client.
* 
* Existing files use:
* import { supabase } from '@/lib/supabase';
* 
* Keep that API while creating the real client only when
* a Supabase operation is actually used.
  */
  export const supabase = {
  get auth() {
  return getSupabaseClient().auth;
  },

from(...args) {
return getSupabaseClient().from(...args);
},

rpc(...args) {
return getSupabaseClient().rpc(...args);
},

channel(...args) {
return getSupabaseClient().channel(...args);
},

removeChannel(...args) {
return getSupabaseClient().removeChannel(...args);
},

get storage() {
return getSupabaseClient().storage;
},
};

export async function signUp(email, password, displayName) {
return await getSupabaseClient().auth.signUp({
email,
password,
options: {
data: {
display_name: displayName,
},
},
});
}

export async function signIn(email, password) {
return await getSupabaseClient().auth.signInWithPassword({
email,
password,
});
}

export async function signOut() {
return await getSupabaseClient().auth.signOut();
}

export async function getSession() {
const {
data: { session },
error,
} = await getSupabaseClient().auth.getSession();

if (error) {
console.error('Supabase getSession error:', error);
return null;
}

return session;
}

export async function getCurrentUser() {
const {
data: { user },
error,
} = await getSupabaseClient().auth.getUser();

if (error) {
console.error('Supabase getCurrentUser error:', error);
return null;
}

return user;
}
