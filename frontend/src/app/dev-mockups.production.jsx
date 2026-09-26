// Vite aliases the development-only mockup entry to this inert module in
// production builds. Keep this file free of imports from src/dev.
export function isDevMockupRequest() {
  return false;
}

export function DevMockupRoute() {
  return null;
}

export function useDevMockupShortcut() {}
