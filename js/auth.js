/* ============================
   Autenticación - admin-carneconcuero
   ============================ */

   const Auth = (() => {
    // Verifica si hay sesión activa. Si no, redirige a login.html.
    // Devuelve el usuario o null.
    async function requerirSesion() {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error || !data.session) {
        window.location.href = 'login.html';
        return null;
      }
      return data.session.user;
    }
  
    // Si ya hay sesión activa, redirige a index.html (para login.html).
    async function redirigirSiLogueado() {
      const { data, error } = await supabaseClient.auth.getSession();
      if (!error && data.session) {
        window.location.href = 'index.html';
      }
    }
  
    // Login con email y contraseña.
    async function login(email, password) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });
      if (error) {
        return { ok: false, mensaje: error.message };
      }
      return { ok: true, user: data.user };
    }
  
    // Logout.
    async function logout() {
      await supabaseClient.auth.signOut();
      window.location.href = 'login.html';
    }
  
    // Devuelve el email del usuario actual (o vacío).
    async function emailActual() {
      const { data } = await supabaseClient.auth.getUser();
      return data && data.user ? data.user.email : '';
    }
  
    return {
      requerirSesion,
      redirigirSiLogueado,
      login,
      logout,
      emailActual
    };
  })();
