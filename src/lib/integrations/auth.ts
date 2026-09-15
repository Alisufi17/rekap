// Shared secret between this app and wa-ai-cs (the owner's separate
// WhatsApp AI customer-service system, own repo/deploy) - set
// WA_INTEGRATION_SECRET to the same value in both apps' env vars. There is
// no other authentication on these routes (no Supabase user session makes
// sense for a server-to-server call), so this is the entire boundary.
export function isValidIntegrationSecret(provided: string | null): boolean {
  const expected = process.env.WA_INTEGRATION_SECRET;
  return Boolean(expected) && provided === expected;
}
