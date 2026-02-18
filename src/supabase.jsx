import { createClient } from "@supabase/supabase-js";

const SUPA_URL = "https://mbkwpaxissvvjhewkggl.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

export const sb = createClient(SUPA_URL, SUPA_KEY);