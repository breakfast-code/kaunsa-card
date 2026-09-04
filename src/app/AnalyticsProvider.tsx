"use client";

import type { PostHog } from "posthog-js";
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef } from "react";

type Properties = Record<string, string | number | boolean | null | undefined>;
type Capture = (event: string, properties?: Properties) => void;
const noopCapture: Capture = () => undefined;
const AnalyticsContext = createContext<Capture>(noopCapture);

export function useAnalytics() {
  return useContext(AnalyticsContext);
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const client = useRef<PostHog | null>(null);
  const pending = useRef<Array<{ event: string; properties?: Properties }>>([]);
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    let active = true;
    const load = () => {
      void import("posthog-js").then(({ default: posthog }) => {
        if (!active) return;
        if (!posthog.__loaded) posthog.init(key, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
          capture_pageview: false,
          capture_pageleave: true,
          autocapture: false,
          disable_session_recording: true,
          capture_performance: false,
          person_profiles: "always",
        });
        client.current = posthog;
        posthog.capture("$pageview");
        for (const item of pending.current) posthog.capture(item.event, item.properties);
        pending.current = [];
      });
    };
    let cancelLoad: () => void;
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(load, { timeout: 2000 });
      cancelLoad = () => window.cancelIdleCallback(idleId);
    } else {
      const timeoutId = globalThis.setTimeout(load, 1000);
      cancelLoad = () => globalThis.clearTimeout(timeoutId);
    }
    return () => {
      active = false;
      cancelLoad();
    };
  }, []);
  const capture = useCallback((event: string, properties?: Properties) => {
    if (client.current) client.current.capture(event, properties);
    else pending.current.push({ event, properties });
  }, []);
  return <AnalyticsContext value={capture}>{children}</AnalyticsContext>;
}
