/** Dev-only admin navigation panel. Stripped from production bundles via import.meta.env.DEV. */
export const IS_ADMIN_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_ADMIN !== 'false';
