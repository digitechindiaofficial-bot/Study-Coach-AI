import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./index.css";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error("Missing Publishable Key");
}

// In production, route Clerk Frontend API calls through the backend proxy so
// Clerk works on the .replit.app domain without requiring DNS CNAME setup.
// In development, leave proxyUrl undefined — dev/test keys don't support proxying.
const clerkProxyUrl = import.meta.env.PROD
  ? `${window.location.origin}/api/__clerk`
  : undefined;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={clerkPubKey}
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
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
      <App />
    </ClerkProvider>
  </StrictMode>
);