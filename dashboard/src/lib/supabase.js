'use client';

import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;

function getSupabase() {
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
},
});

return supabaseInstance;
}

export const supabase = {
get auth() {
return getSupabase().auth;
},

from(...args) {
return getSupabase().from(...args);
},

rpc(...args) {
return getSupabase().rpc(...args);
},

storage: {
get from() {
return (...args) => getSupabase().storage.from(...args);
},
},
};

export async function signUp(email, password, displayName) {
const { data, error } = await getSupabase().auth.signUp({
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
const { data, error } = await getSupabase().auth.signInWithPassword({
email,
password,
});

return { data, error };
}

export async function signOut() {
await getSupabase().auth.signOut();
}

export async function getSession() {
const {
data: { session },
} = await getSupabase().auth.getSession();

return session;
}

export async function getCurrentUser() {
const {
data: { user },
} = await getSupabase().auth.getUser();

return user;
}
