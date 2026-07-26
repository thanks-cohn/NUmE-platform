export const PLACEMENT_STATES = ["draft", "scheduled", "active", "paused", "expired", "cancelled", "rejected"];

export function validateHeadingPlacements(rows) {
  const allowed = new Set(["start", "quarter", "center", "three-quarter", "end", "vertical-start", "vertical-end"]);
  const errors = [];
  rows.forEach((row, index) => {
    if (!allowed.has(row.heading_placement)) errors.push(`${row.row_id}: invalid heading placement ${row.heading_placement}`);
    if (index && row.heading_placement === rows[index - 1].heading_placement) errors.push(`${row.row_id}: adjacent rows cannot share ${row.heading_placement}`);
  });
  return errors;
}

export function storefrontAnchor(layout, storefrontId, requestedAnchor) {
  const assigned = layout.rows.filter((row) => row.storefront_id === storefrontId);
  if (!assigned.length) return null;
  if (requestedAnchor && assigned.some((row) => row.row_id === requestedAnchor)) return requestedAnchor;
  return assigned[Math.floor(assigned.length / 2)].row_id;
}

export function resolveFeaturedPlacement(config, layout, { now = new Date(), slug, geographicScope = "global" } = {}) {
  const storefronts = new Map(layout.storefronts.map((storefront) => [storefront.storefront_id, storefront]));
  const requested = slug && layout.storefronts.find((storefront) => storefront.slug === slug && storefront.status === "active");
  if (requested) return { storefront_id: requested.storefront_id, anchor_row_id: storefrontAnchor(layout, requested.storefront_id), reason: "session-link" };
  const time = +new Date(now);
  const eligible = config.placements.filter((placement) => {
    const storefront = storefronts.get(placement.storefront_id);
    return placement.status === "active" && placement.moderation_status === "approved" && storefront?.status === "active" &&
      +new Date(placement.effective_from) <= time && (!placement.effective_until || time < +new Date(placement.effective_until)) &&
      (placement.geographic_scope.includes("global") || placement.geographic_scope.includes(geographicScope)) &&
      storefrontAnchor(layout, placement.storefront_id, placement.anchor_row_id);
  }).sort((a, b) => b.priority - a.priority || +new Date(b.effective_from) - +new Date(a.effective_from) || a.placement_id.localeCompare(b.placement_id));
  const winner = eligible[0];
  if (winner) return { storefront_id: winner.storefront_id, anchor_row_id: storefrontAnchor(layout, winner.storefront_id, winner.anchor_row_id), placement_id: winner.placement_id, reason: slug ? "invalid-session-link-fallback" : "active-placement" };
  const fallback = storefronts.get(config.fallback_storefront_id)?.status === "active" ? config.fallback_storefront_id : layout.storefronts.find((item) => item.status === "active" && storefrontAnchor(layout, item.storefront_id))?.storefront_id;
  return fallback ? { storefront_id: fallback, anchor_row_id: storefrontAnchor(layout, fallback), reason: "marketplace-fallback" } : null;
}

export function createPlacementVersion(config, layout, input, operatorId, now = new Date()) {
  const storefront = layout.storefronts.find((item) => item.storefront_id === input.storefront_id || item.slug === input.storefront_id);
  if (!storefront || storefront.status !== "active") throw new Error("Storefront does not exist or is not active");
  const anchor = storefrontAnchor(layout, storefront.storefront_id, input.anchor_row_id);
  if (!anchor) throw new Error("Storefront has no active row assignment or the anchor is invalid");
  const version = Math.max(0, ...config.placements.map((item) => item.version ?? 0)) + 1;
  const at = now.toISOString();
  return { placement_id: `placement_${version}_${Date.now()}`, version, storefront_id: storefront.storefront_id, anchor_row_id: anchor, effective_from: input.effective_from ?? at, effective_until: input.effective_until ?? null, priority: Number(input.priority ?? 100), geographic_scope: input.geographic_scope ?? ["global"], campaign_owner: input.campaign_owner ?? "nume-platform", contract_reference: input.contract_reference ?? null, status: "active", moderation_status: "approved", operator_approved_by: operatorId, audit_history: [{ event: "activated", at, actor: operatorId }] };
}

export function activatePlacement(config, placement, operatorId, now = new Date()) {
  const at = now.toISOString();
  return { ...config, placements: [...config.placements.map((item) => item.status === "active" ? { ...item, status: "paused", audit_history: [...item.audit_history, { event: "superseded", at, actor: operatorId }] } : item), placement] };
}

export function rollbackPlacement(config, placementId, operatorId, now = new Date()) {
  const target = config.placements.find((item) => item.placement_id === placementId);
  if (!target) throw new Error("Rollback placement was not found");
  const at = now.toISOString();
  return { ...config, placements: config.placements.map((item) => ({ ...item, status: item.placement_id === placementId ? "active" : item.status === "active" ? "paused" : item.status, audit_history: item.placement_id === placementId ? [...item.audit_history, { event: "rollback-activated", at, actor: operatorId }] : item.audit_history })) };
}
