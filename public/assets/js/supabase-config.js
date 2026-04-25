window.LEXICON_SUPABASE_CONFIG = {
  url: "https://qbtobhjrpcvcnacsidhk.supabase.co",
  publishableKey: "sb_publishable_vb1i4OtnlWE88_CK1mnMKA_-xfo49p1",
  // Production deployments should override this with the deployed Worker URL.
  // Leave it blank to fall back to the current origin's /api/admin/auth/login path.
  adminAuthApiUrl:
    window.LEXICON_ADMIN_AUTH_API_URL ||
    "https://alpine-lang-learning-app-admin-auth.twkhjl.workers.dev/api/admin/auth/login",
};
