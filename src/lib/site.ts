export type SiteRole = "patient" | "staff";

/**
 * The same codebase serves two distinct sites: the patient-facing practice
 * site (default) and the staff workspace. Deployment sets SITE_ROLE=staff on
 * the staff server so each site only exposes its own routes and sign-in UI.
 */
function getSiteRole(): SiteRole {
  return process.env.SITE_ROLE === "staff" ? "staff" : "patient";
}

export function isStaffSite(): boolean {
  return getSiteRole() === "staff";
}

/**
 * Route handlers use this to make the wrong site look nonexistent rather than
 * partially available.
 */
export function wrongSiteResponse(expected: SiteRole): Response | null {
  return getSiteRole() === expected
    ? null
    : new Response(null, { status: 404 });
}
