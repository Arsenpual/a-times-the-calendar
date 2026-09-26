import React from "react";
import { useAuth } from "../features/auth/hooks/use-auth.js";
import { DevMockupRoute, isDevMockupRequest, useDevMockupShortcut } from "@dev-mockups";
import AccountApp from "./account-app.jsx";

export default function App() {
  useDevMockupShortcut();
  return isDevMockupRequest() ? <DevMockupRoute /> : <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const auth = useAuth();
  return <AccountApp key={auth.firebaseUser?.uid || "guest"} auth={auth} />;
}
