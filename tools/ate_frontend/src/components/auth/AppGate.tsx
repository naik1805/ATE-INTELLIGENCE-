"use client";

import { AuthGate, OfflineDesktopGate } from "@/components/auth/AuthGate";
import { VerilumenBrand } from "@/components/branding/VerilumenBrand";
import { useEffect, useState } from "react";

function BootSplash({ label }: { label: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="vl-enter mb-6">
        <VerilumenBrand size="auth" />
      </div>
      <p className="text-[12px] text-[var(--muted)]">{label}</p>
    </div>
  );
}

/** True for localhost, LAN IPs, and Windows machine names (portable zip on other PCs). */
function isPortableHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  if (host === "127.0.0.1" || host === "localhost" || host === "[::1]") return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  // Single-label hostnames (e.g. DESKTOP-ABC) — typical on shared zip / LAN installs.
  if (!host.includes(".")) return true;
  return false;
}

function envSaysOffline(): boolean {
  return process.env.NEXT_PUBLIC_OFFLINE_DESKTOP === "1";
}

/**
 * Portable/desktop installs skip cloud login. Only hosted (Vercel) deployments
 * use the AuthGate login form unless explicitly configured otherwise.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const envOffline = envSaysOffline();
  const [offline, setOffline] = useState<boolean | null>(
    envOffline || isPortableHost() ? true : null,
  );

  useEffect(() => {
    if (envOffline || isPortableHost()) {
      setOffline(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          const me = (await res.json()) as { username?: string; user_id?: string };
          setOffline(me.username === "local" || me.user_id === "offline-local");
        } else {
          setOffline(false);
        }
      } catch {
        if (!cancelled) setOffline(isPortableHost());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [envOffline]);

  if (offline === null) {
    return <BootSplash label="Starting…" />;
  }

  if (offline) {
    return <OfflineDesktopGate>{children}</OfflineDesktopGate>;
  }

  return <AuthGate>{children}</AuthGate>;
}
