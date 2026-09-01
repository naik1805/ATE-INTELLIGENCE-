"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAgentConfig } from "../../../agents.config";
import {
  buildAutoloadMessage,
  postAutoloadToIframe,
} from "@/lib/agentAutoload";
import {
  readDashboardAgentCache,
  writeDashboardAgentCache,
} from "@/lib/agentSessionCache";

export function AgentDetailView({ agentId }: { agentId: string }) {
  const config = getAgentConfig(agentId);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "cached" | "loading" | "ready" | "error">(
    "idle",
  );
  const cacheAckRef = useRef(false);
  const autoloadStartedRef = useRef(false);

  const deliverToIframe = useCallback(async () => {
    if (!config || autoloadStartedRef.current) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const dataBase = `${window.location.origin}/api/default-data`;
    const cached = readDashboardAgentCache(agentId);

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
      setLoadState("error");
    }
  }, [agentId, config]);

  useEffect(() => {
    cacheAckRef.current = false;
    autoloadStartedRef.current = false;

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
    const dataBase = `${window.location.origin}/api/default-data`;
    const join = config.ui_url.includes("?") ? "&" : "?";
    setIframeSrc(
      `${config.ui_url}${join}autoload=1&dataBase=${encodeURIComponent(dataBase)}`,
    );
    if (readDashboardAgentCache(agentId)) {
      setLoadState("cached");
    } else {
      setLoadState("loading");
    }
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

    return () => {
      iframe.removeEventListener("load", onLoad);
      window.clearTimeout(retry);
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
        {loadState === "loading" ? (
          <span className="text-sm text-[var(--muted)]">Loading default data…</span>
        ) : loadState === "cached" ? (
          <span className="text-sm text-[var(--muted)]">Restored from cache</span>
        ) : loadState === "error" ? (
          <span className="text-sm text-amber-400">
            Default data could not be prepared — use manual upload in the agent.
          </span>
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
      ) : null}
    </div>
  );
}
