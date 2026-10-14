/* Optional cloud save through Supabase. Turns itself off when config.js has no keys. */
var Cloud = (function () {
  var cfg = window.MASSSTUDY_CONFIG || {};
  var SRC = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  var client = null, user = null, listeners = [], readyP = null;
  var configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);

  function loadLib() {
    return new Promise(function (res, rej) {
      if (window.supabase && window.supabase.createClient) return res();
      var s = document.createElement('script'); s.src = SRC; s.async = true; s.onload = res;
      s.onerror = function () { rej(new Error('lib')); };
      document.head.appendChild(s);
    });
  }
  function init() {
    if (!configured) return Promise.resolve(false);
    if (readyP) return readyP;
    readyP = loadLib().then(function () {
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
      client.auth.onAuthStateChange(function (_e, session) { setUser(session ? session.user : null); });
      return client.auth.getSession().then(function (r) { setUser(r.data.session ? r.data.session.user : null); return true; });
    }).catch(function () { configured = false; return false; });
    return readyP;
  }
  function setUser(u) {
    var changed = (u && u.id) !== (user && user.id);
    user = u;
    if (changed) listeners.forEach(function (f) { f(user); });
  }
  function need() { if (!client || !user) throw new Error('로그인이 필요해요.'); }
  function unwrap(r) { if (r.error) throw r.error; return r.data; }

  return {
    get enabled() { return configured; },
    get user() { return user; },
    init: init,
    onUser: function (f) { listeners.push(f); },
    signIn: function (email) {
      return init().then(function () {
        return client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + location.pathname } }).then(unwrap);
      });
    },
    signOut: function () { return client ? client.auth.signOut() : Promise.resolve(); },
    list: function () {
      need();
      return client.from('projects').select('id,name,updated_at,is_public,summary').eq('user_id', user.id).order('updated_at', { ascending: false }).then(unwrap);
    },
    get: function (id) { return init().then(function () { return client.from('projects').select('id,name,data,is_public,user_id,updated_at').eq('id', id).maybeSingle().then(unwrap); }); },
    save: function (p) {
      need();
      return client.from('projects').upsert({ id: p.id, user_id: user.id, name: p.name, data: p.data, summary: p.summary, updated_at: new Date().toISOString() }).then(unwrap);
    },
    remove: function (id) { need(); return client.from('projects').delete().eq('id', id).then(unwrap); },
    setPublic: function (id, v) { need(); return client.from('projects').update({ is_public: v }).eq('id', id).then(unwrap); }
  };
})();
