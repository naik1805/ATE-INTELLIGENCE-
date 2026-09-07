"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAgentConfig } from "../../../agents.config";
import {
  buildAutoloadMessage,
  postAutoloadToIframe,
} from "@/lib/agentAutoload";
import {
  clearDashboardAgentCache,
  readDashboardAgentCache,
  writeDashboardAgentCache,
} from "@/lib/agentSessionCache";

async function waitForAgentUi(url: string, attempts = 20): Promise<boolean> {
  const probe = url.split("?")[0] || url;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(probe, { method: "GET", mode: "no-cors", cache: "no-store" });
      // no-cors opaque responses still mean the host answered.
      if (res.type === "opaque" || res.ok || res.status < 500) return true;
    } catch {
      /* still starting */
    }
    await new Promise((r) => window.setTimeout(r, 1500));
  }
  return false;
}

export function AgentDetailView({ agentId }: { agentId: string }) {
  const config = getAgentConfig(agentId);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "cached" | "loading" | "ready" | "waiting">(
    "idle",
  );
  const cacheAckRef = useRef(false);
  const autoloadStartedRef = useRef(false);
  const reloadCountRef = useRef(0);

  const deliverToIframe = useCallback(async () => {
    if (!config || autoloadStartedRef.current) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const dataBase = `${window.location.origin}/api/default-data`;
    const cached = agentId === "dtl" ? null : readDashboardAgentCache(agentId);

    if (cached) {
      iframe.contentWindow.postMessage(
        { type: "verilumen-cache-restore", agentId, payload: cached },
        "*",
      );
      setLoadState("cached");
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      if (cacheAckRef.current) return;
    }

    autoloadStartedRef.current = true;
    setLoadState("loading");
    try {
      const message = await buildAutoloadMessage(agentId, dataBase);
      postAutoloadToIframe(iframe, message);
      setLoadState("ready");
    } catch {
      // Agent UI still loads in the iframe; default-data is optional.
      setLoadState("ready");
    }
  }, [agentId, config]);

  useEffect(() => {
    cacheAckRef.current = false;
    autoloadStartedRef.current = false;
    reloadCountRef.current = 0;

    const onMessage = (ev: MessageEvent) => {
      if (ev.data?.agentId !== agentId) return;
      if (ev.data?.type === "verilumen-agent-cache" && ev.data.payload) {
        writeDashboardAgentCache(agentId, ev.data.payload as Record<string, unknown>);
        setLoadState("ready");
      }
      if (ev.data?.type === "verilumen-cache-ack") {
        cacheAckRef.current = true;
        autoloadStartedRef.current = true;
        setLoadState("cached");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [agentId]);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    const dataBase = `${window.location.origin}/api/default-data`;
    const join = config.ui_url.includes("?") ? "&" : "?";
    const target = `${config.ui_url}${join}autoload=1&dataBase=${encodeURIComponent(dataBase)}`;

    setLoadState(readDashboardAgentCache(agentId) ? "cached" : "waiting");

    void (async () => {
      const ready = await waitForAgentUi(config.ui_url);
      if (cancelled) return;
      setIframeSrc(target);
      setLoadState(readDashboardAgentCache(agentId) ? "cached" : "loading");
      if (!ready && reloadCountRef.current < 2) {
        // Soft retry: keep waiting without flashing connection errors.
        reloadCountRef.current += 1;
        window.setTimeout(() => {
          if (!cancelled) setIframeSrc(`${target}&_r=${Date.now()}`);
        }, 2500);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agentId, config]);

  useEffect(() => {
    if (!iframeSrc) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onLoad = () => {
      void deliverToIframe();
    };

    iframe.addEventListener("load", onLoad);
    const retry = window.setTimeout(() => {
      void deliverToIframe();
    }, 1200);
    const retry2 = window.setTimeout(() => {
      void deliverToIframe();
    }, 4000);

    return () => {
      iframe.removeEventListener("load", onLoad);
      window.clearTimeout(retry);
      window.clearTimeout(retry2);
    };
  }, [iframeSrc, deliverToIframe]);

  if (!config) {
    return (
      <div className="mx-auto max-w-[1400px] px-7 pb-[90px] pt-[30px]">
        <div className="vl-state-panel">Unknown agent: {agentId}</div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--bg)]">
      <header className="flex shrink-0 items-center justify-between border-b border-[rgba(107,193,242,0.18)] bg-[var(--bg)] px-7 py-3">
        {loadState === "waiting" || loadState === "loading" ? (
          <span className="text-sm text-[var(--muted)]">Starting agent…</span>
        ) : loadState === "cached" ? (
          <span className="text-sm text-[var(--muted)]">Restored from cache</span>
        ) : (
          <span />
        )}
        <Link href="/" className="vl-chip no-underline">
          ← Back to dashboard
        </Link>
      </header>
      {iframeSrc ? (
        <iframe
          ref={iframeRef}
          title={config.name}
          src={iframeSrc}
          className="min-h-0 flex-1 w-full border-0"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
          Preparing agent UI…
        </div>
      )}
    </div>
  );
}
