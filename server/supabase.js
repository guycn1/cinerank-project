/**
 * The server's one Supabase client.
 *
 * @module server/supabase
 */
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

/**
 * One shared client, created with the ANON key only — never the service_role key
 * (CLAUDE.md § Security & Secrets #3). Every table access in this project goes
 * through this client's query builder (.select/.insert/.update/.delete/.eq…);
 * there are no hand-built SQL strings anywhere in the app (#2).
 *
 * The tests never reach it: test/routes.test.js swaps this module for the
 * in-memory fake in test/helpers.js.
 */
export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: { persistSession: false },
});
