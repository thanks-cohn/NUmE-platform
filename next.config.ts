import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true" || Boolean(process.env.NUME_PAGES_BASE_PATH);
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1) || "NUmE-platform";
const requestedBase = process.env.NUME_PAGES_BASE_PATH?.replace(/^\/+|\/+$/g, "");
const basePath = isGitHubPages ? `/${requestedBase || repositoryName}` : "";

const nextConfig: NextConfig = {
  ...(isGitHubPages ? {
    output: "export" as const,
    trailingSlash: true,
    basePath,
    assetPrefix: `${basePath}/`,
    env: { NEXT_PUBLIC_BASE_PATH: basePath },
    images: { unoptimized: true },
    typescript: { tsconfigPath: "./tsconfig.pages.json" },
  } : {}),
};
export default nextConfig;
