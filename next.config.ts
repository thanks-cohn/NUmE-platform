import type { NextConfig } from "next";
const isGitHubPages=process.env.NUME_BUILD_TARGET==="github-pages";
const repositoryName=process.env.GITHUB_REPOSITORY?.split("/").at(-1)||"NUmE-platform";
const requestedBase=process.env.NUME_PAGES_BASE_PATH?.replace(/^\/+|\/+$/g,"");
const basePath=isGitHubPages?`/${requestedBase||repositoryName}`:"";
const nextConfig:NextConfig={...(isGitHubPages?{output:"export" as const,trailingSlash:true,basePath,assetPrefix:basePath,env:{NEXT_PUBLIC_BASE_PATH:basePath,NEXT_PUBLIC_NUME_TARGET:"github-pages"},images:{unoptimized:true},typescript:{tsconfigPath:"./tsconfig.pages.json"}}:{env:{NEXT_PUBLIC_BASE_PATH:"",NEXT_PUBLIC_NUME_TARGET:"cloudflare"}})};
export default nextConfig;
