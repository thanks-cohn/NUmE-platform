/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { runtimeCapabilities } from "../../../lib/runtime-capabilities";
export default function FeaturedStorefrontControl() {
  const [storefront, setStorefront] = useState("storefront_numenume"), [anchor, setAnchor] = useState("row_nume_objects"), [token, setToken] = useState(""), [result, setResult] = useState<any>(null);
  async function run(action: "preview" | "activate" | "rollback") { const response = await fetch("/api/operator/featured-storefront", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ action, storefront_id: storefront, anchor_row_id: anchor, placement_id: result?.configuration?.placements?.find((item:any)=>item.status==="paused")?.placement_id }) }); setResult(await response.json()); }
  if (!runtimeCapabilities.capabilities.catalog_update) return <main className="operator-control"><h1>Featured storefront</h1><p role="status"><strong>Platform administration requires the full NUME platform.</strong></p></main>;
  return <main className="operator-control"><h1>Featured storefront</h1><p><strong>Development-only operator control.</strong> Disabled unless explicitly enabled; production requires a verified platform-operator session.</p><label>Storefront ID or slug<input value={storefront} onChange={event=>setStorefront(event.target.value)} /></label><label>Anchor row ID<input value={anchor} onChange={event=>setAnchor(event.target.value)} /></label><label>Operator token<input type="password" value={token} onChange={event=>setToken(event.target.value)} /></label><div><button onClick={()=>run("preview")}>Preview position</button><button onClick={()=>run("activate")}>Activate atomically</button><button onClick={()=>run("rollback")}>Rollback</button></div><pre>{JSON.stringify(result,null,2)}</pre></main>;
}
