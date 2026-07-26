/* eslint-disable @typescript-eslint/no-explicit-any */
export function validateHeadingPlacements(rows: Array<{row_id:string;heading_placement:string}>): string[];
export function storefrontAnchor(layout: any, storefrontId: string, requestedAnchor?: string): string | null;
export function resolveFeaturedPlacement(config: any, layout: any, options?: {now?: Date;slug?: string;geographicScope?: string}): {storefront_id:string;anchor_row_id:string;reason:string;placement_id?:string}|null;
export function createPlacementVersion(config:any, layout:any, input:any, operatorId:string, now?:Date): any;
export function activatePlacement(config:any, placement:any, operatorId:string, now?:Date): any;
export function rollbackPlacement(config:any, placementId:string, operatorId:string, now?:Date): any;
