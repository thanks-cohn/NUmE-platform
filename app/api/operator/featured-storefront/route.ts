/* eslint-disable @typescript-eslint/no-explicit-any */
import configSeed from "../../../../data/presentation/featured-placements.v1.json";
import layout from "../../../../data/catalog-sync/published-layout.v1.json";
import { activatePlacement, createPlacementVersion, resolveFeaturedPlacement, rollbackPlacement } from "../../../../lib/featured-placement.mjs";
import { operatorSession } from "../../../../lib/operator-auth";
let configuration: any = structuredClone(configSeed);
export async function POST(request: Request) {
  const session = await operatorSession(request);
  if (!session) return Response.json({ error: "Platform-operator authorization required" }, { status: 403 });
  try {
    const body = await request.json() as any;
    if (body.action === "preview") {
      const placement = createPlacementVersion(configuration, layout, body, session.operatorId);
      return Response.json({ placement, resolution: resolveFeaturedPlacement({ ...configuration, placements: [placement] }, layout) });
    }
    if (body.action === "rollback") configuration = rollbackPlacement(configuration, body.placement_id, session.operatorId);
    else {
      const placement = createPlacementVersion(configuration, layout, body, session.operatorId);
      configuration = activatePlacement(configuration, placement, session.operatorId);
    }
    return Response.json({ configuration, resolution: resolveFeaturedPlacement(configuration, layout), development_only: session.developmentOnly });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
