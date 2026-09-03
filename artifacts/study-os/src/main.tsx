import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./index.css";
import {
  ClerkAppAuthProvider,
  isPreviewEnvironment,
  PreviewAppAuthProvider,
} from "./lib/app-auth";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!isPreviewEnvironment() && !clerkPubKey) {
  throw new Error("Missing Publishable Key");
}

const app = isPreviewEnvironment() ? (
  <PreviewAppAuthProvider>
    <App />
  </PreviewAppAuthProvider>
) : (
  <ClerkProvider
    publishableKey={clerkPubKey}
    afterSignOutUrl="/"
    localization={{
      signIn: {
        start: {
          title: "Sign in to GovtGuru",
          subtitle: "Welcome back! Please sign in to continue",
        },
      },
      signUp: {
        start: {
          title: "Create your GovtGuru account",
          subtitle: "Start your exam prep journey today",
        },
      },
    }}
  >
    <ClerkAppAuthProvider>
      <App />
    </ClerkAppAuthProvider>
  </ClerkProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>{app}</StrictMode>,
);