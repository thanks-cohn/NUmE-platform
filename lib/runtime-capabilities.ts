export type DeploymentTarget = "local" | "cloudflare" | "github-pages";
export type RuntimeCapabilities = { target: DeploymentTarget; apiBaseUrl: string; capabilities: { storefront: true; catalog_read: true; catalog_validate: boolean; catalog_update: boolean; merchant_auth: boolean; stripe: boolean } };
export function resolveRuntimeCapabilities(target=(process.env.NEXT_PUBLIC_NUME_TARGET||"local") as DeploymentTarget, remoteApi=process.env.NEXT_PUBLIC_NUME_API_BASE_URL||""): RuntimeCapabilities {
  const apiBaseUrl=remoteApi ? new URL(remoteApi).origin : "";
  if(target==="github-pages"&&!apiBaseUrl)return {target,apiBaseUrl,capabilities:{storefront:true,catalog_read:true,catalog_validate:false,catalog_update:false,merchant_auth:false,stripe:false}};
  if(target==="github-pages")return {target,apiBaseUrl,capabilities:{storefront:true,catalog_read:true,catalog_validate:true,catalog_update:true,merchant_auth:true,stripe:false}};
  return {target,apiBaseUrl,capabilities:{storefront:true,catalog_read:true,catalog_validate:true,catalog_update:true,merchant_auth:true,stripe:target==="cloudflare"}};
}
export const runtimeCapabilities=resolveRuntimeCapabilities();
