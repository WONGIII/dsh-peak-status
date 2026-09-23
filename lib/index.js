/**
 * Host half of dsh-peak-status: a no-op plugin.
 *
 * The Loader row this mounts is what makes `dsh-client-modules` serve the
 * browser half (`./client`) to the web page. Disabling the row removes the
 * status row from the composer; there is no host-side service to stop.
 */
export const name = "@dsh-external/dsh-peak-status"
export function apply() {}
