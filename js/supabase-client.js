/* ============================
   Cliente Supabase - admin-carneconcuero
   ============================ */

// Se carga el SDK de Supabase desde CDN antes que este archivo.
// El objeto global es window.supabase.

const supabaseClient = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_KEY
  );