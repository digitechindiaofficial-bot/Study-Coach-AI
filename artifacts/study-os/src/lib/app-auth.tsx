import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuth, useClerk, useUser } from "@clerk/react";

export interface AppUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  imageUrl: string;
  primaryEmailAddress: { emailAddress: string } | null;
}

interface AppAuthValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: AppUser | null;
  getToken: () => Promise<string | null>;
  signOut: (options?: { redirectUrl?: string }) => Promise<void>;
  enterPreview: () => void;
}

const AppAuthContext = createContext<AppAuthValue | null>(null);

export function isPreviewEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".replit.dev") ||
    hostname.endsWith(".replit.app")
  );
}

/**
 * Bridges Clerk into the app's small auth interface. This component is only
 * mounted inside ClerkProvider in real environments.
 */
export function ClerkAppAuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const value = useMemo<AppAuthValue>(() => ({
    isLoaded,
    isSignedIn: !!isSignedIn,
    userId: userId ?? null,
    user: user
      ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          imageUrl: user.imageUrl,
          primaryEmailAddress: user.primaryEmailAddress
            ? { emailAddress: user.primaryEmailAddress.emailAddress }
            : null,
        }
      : null,
    getToken,
    signOut,
    enterPreview: () => undefined,
  }), [getToken, isLoaded, isSignedIn, signOut, user, userId]);

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

/**
 * Clerk production keys are intentionally restricted to govtguru.com, so
 * they cannot initialize inside Replit's preview domain. This local-only
 * session lets the UI be inspected without creating a real authenticated
 * session or changing production auth behavior.
 */
export function PreviewAppAuthProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(() => {
    try {
      return window.localStorage.getItem("govtguru-preview-session") === "true";
    } catch {
      return false;
    }
  });

  const enterPreview = () => {
    try {
      window.localStorage.setItem("govtguru-preview-session", "true");
    } catch {
      // The preview still works if storage is unavailable.
    }
    setIsSignedIn(true);
  };

  const signOut = async ({ redirectUrl = "/" }: { redirectUrl?: string } = {}) => {
    try {
      window.localStorage.removeItem("govtguru-preview-session");
    } catch {
      // Ignore storage restrictions during preview sign-out.
    }
    setIsSignedIn(false);
    if (redirectUrl) window.history.replaceState({}, "", redirectUrl);
  };

  const value = useMemo<AppAuthValue>(() => ({
    isLoaded: true,
    isSignedIn,
    userId: isSignedIn ? "preview-user" : null,
    user: isSignedIn
      ? {
          id: "preview-user",
          firstName: "Preview",
          lastName: "User",
          fullName: "Preview User",
          imageUrl: "",
          primaryEmailAddress: { emailAddress: "preview@govtguru.local" },
        }
      : null,
    getToken: async () => null,
    signOut,
    enterPreview,
  }), [isSignedIn]);

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

export function useAppAuth(): AppAuthValue {
  const value = useContext(AppAuthContext);
  if (!value) throw new Error("useAppAuth must be used inside an app auth provider");
  return value;
}

export function useAppUser() {
  return useAppAuth();
}

export function useAppClerk() {
  const { signOut } = useAppAuth();
  return { signOut };
}