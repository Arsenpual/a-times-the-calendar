import React from "react";
import { useAuth } from "../features/auth/hooks/use-auth.js";
import { DevMockupRoute, isDevMockupRequest, useDevMockupShortcut } from "@dev-mockups";
import AccountApp from "./account-app.jsx";
import { PopupLayerProvider } from "../shared/ui/popup-layer.jsx";

export default function App() {
  useDevMockupShortcut();
  return isDevMockupRequest() ? <DevMockupRoute /> : <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const auth = useAuth();
  return (
    <PopupLayerProvider>
      <AccountApp key={auth.firebaseUser?.uid || "guest"} auth={auth} />
    </PopupLayerProvider>
  );
}
