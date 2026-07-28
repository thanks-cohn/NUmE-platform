"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Product, StyleTokens } from "../lib/catalog";
import { imagePath } from "../lib/catalog";

const DELAYS = [750, 2000, 5000];
const MAX_CONCURRENT = 3;
type Status = "loading" | "failed" | "ready" | "paused";
type RecordState = { status: Status; cycle: number; timer: number | null; inflight: boolean; listeners: Set<() => void>; url: string };
const records = new Map<string, RecordState>();
let concurrent = 0;

function contrast(hex: string, fallback: string) {
  const clean = hex.match(/^#([\da-f]{6})$/i)?.[1];
  if (!clean) return fallback;
  const rgb = [0, 2, 4].map((at) => parseInt(clean.slice(at, at + 2), 16) / 255).map((v) => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const luminance = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  return (luminance + .05) / .05 >= 4.5 ? "#000000" : "#ffffff";
}
function notify(record: RecordState) { record.listeners.forEach((listener) => listener()); }
function attempt(key: string) {
  const record = records.get(key);
  if (!record || record.inflight || concurrent >= MAX_CONCURRENT || !navigator.onLine) return;
  record.inflight = true; concurrent += 1;
  const probe = new Image();
  const finish = (success: boolean) => {
    if (!record.inflight) return;
    record.inflight = false; concurrent -= 1;
    if (success) { record.status = "ready"; record.cycle = 0; if (record.timer) clearTimeout(record.timer); record.timer = null; }
    else schedule(key);
    notify(record);
  };
  probe.onload = () => { const decoded = probe.decode?.(); if (decoded) decoded.then(() => finish(true), () => finish(false)); else finish(true); };
  probe.onerror = () => finish(false);
  probe.src = record.url;
}
function schedule(key: string) {
  const record = records.get(key); if (!record || record.timer || record.inflight || record.status === "ready") return;
  if (record.cycle >= DELAYS.length) { record.status = "paused"; notify(record); return; }
  record.status = "failed";
  const delay = DELAYS[record.cycle++];
  record.timer = window.setTimeout(() => { record.timer = null; attempt(key); }, delay);
  notify(record);
}
function markReady(key: string) { const value = records.get(key); if (!value) return; value.status = "ready"; value.cycle = 0; notify(value); }
function markFailed(key: string) { const value = records.get(key); if (!value) return; value.status = "failed"; schedule(key); }
function restart(key: string) {
  const record = records.get(key); if (!record || record.inflight || record.status !== "paused") return;
  record.cycle = 0; record.status = "failed"; attempt(key);
}
function sizedUrl(url: string, width: number) {
  if (!/^https:\/\/images\.unsplash\.com\//.test(url)) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("w", String(width));
  parsed.searchParams.set("q", "78");
  return parsed.toString();
}

export function ProductImage({ product, alt, loading = "lazy", vendor, tokens }: { product: Product; alt: string; loading?: "eager" | "lazy"; vendor: string; tokens: StyleTokens }) {
  const url = sizedUrl(imagePath(product), 660);
  const key = `${vendor}:${url || "missing"}`;
  const [, render] = useState(0);
  const record = useMemo(() => {
    let value = records.get(key);
    if (!value) { value = { status: url ? "loading" : "paused", cycle: 0, timer: null, inflight: false, listeners: new Set(), url }; records.set(key, value); }
    return value;
  }, [key, url]);
  useEffect(() => {
    const update = () => render((value) => value + 1);
    record.listeners.add(update);
    const online = () => record.status !== "ready" && attempt(key);
    window.addEventListener("online", online);
    return () => {
      record.listeners.delete(update);
      window.removeEventListener("online", online);
      if (record.listeners.size === 0 && record.status !== "ready") {
        if (record.timer) clearTimeout(record.timer);
        record.timer = null;
        records.delete(key);
      }
    };
  }, [key, record]);
  const background = tokens.vendor_image_fallback_background || tokens.color_surface || "#171717";
  const configured = tokens.vendor_image_fallback_foreground || tokens.color_foreground || "#ffffff";
  const foreground = contrast(background, configured);
  const failed = record.status === "failed" || record.status === "paused";
  const style = { "--image-fallback-bg": background, "--image-fallback-fg": foreground } as CSSProperties;
  return <span className={`product-image ${failed ? "has-failed" : ""}`} style={style} onPointerEnter={() => restart(key)} onFocus={() => restart(key)} onTouchStart={() => restart(key)} tabIndex={failed ? 0 : -1} aria-label={failed ? `${product.title} image temporarily unavailable; focus or touch to retry` : undefined}>
    {!failed && url && <img src={sizedUrl(url, 660)} srcSet={/^https:\/\/images\.unsplash\.com\//.test(url) ? `${sizedUrl(url, 360)} 360w, ${sizedUrl(url, 660)} 660w, ${sizedUrl(url, 960)} 960w` : undefined} sizes="(max-width: 700px) 62vw, (max-width: 1100px) 30vw, 310px" alt={alt} loading={loading} fetchPriority={loading === "eager" ? "high" : "auto"} decoding="async" width={660} height={500} draggable={false} onLoad={(event) => { const image = event.currentTarget; const decoded = image.decode?.(); Promise.resolve(decoded).then(() => { markReady(key); }, () => schedule(key)); }} onError={() => markFailed(key)} />}
    {failed && <span className="product-image-fallback" aria-hidden="true">NUME</span>}
  </span>;
}
