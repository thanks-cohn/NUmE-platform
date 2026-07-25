export const GITHUB_PAGES_REPOSITORY = "NUmE-platform";

export function normalizeBasePath(basePath = "") {
  if (!basePath || basePath === "/") return "";
  return `/${basePath.replace(/^\/+|\/+$/g, "")}`;
}

export function resolveAssetPath(source, basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "") {
  if (!source) return `${normalizeBasePath(basePath)}/products/fallback.svg`;
  if (/^(?:https?:)?\/\//i.test(source) || /^(?:data|blob):/i.test(source)) return source;
  const localPath = source.startsWith("/") ? source : `/${source}`;
  const prefix = normalizeBasePath(basePath);
  return prefix && !localPath.startsWith(`${prefix}/`) ? `${prefix}${localPath}` : localPath;
}

export function productImageFallback(basePath) {
  return resolveAssetPath("/products/fallback.svg", basePath);
}
