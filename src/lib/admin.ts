/**
 * Platform Admin Utilities
 *
 * Checks the ADMIN_EMAILS environment variable (comma-separated)
 * to determine if a user email has platform admin privileges.
 * Used for the /admin section and impersonation.
 *
 * The env var is parsed on every call (no module-level cache) so that
 * changes to ADMIN_EMAILS propagate without requiring a server restart
 * or waiting for Vercel to recycle the serverless instance.
 */

/** Check if the given email is in the ADMIN_EMAILS allowlist. */
export function isPlatformAdmin(email: string): boolean {
    if (!email) return false;
    const raw = process.env.ADMIN_EMAILS || '';
    const adminEmails = new Set(
        raw.split(',')
            .map(e => e.trim().toLowerCase())
            .filter(Boolean)
    );
    return adminEmails.has(email.toLowerCase());
}
