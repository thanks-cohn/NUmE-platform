import Home from "../../page";
import layout from "../../../data/catalog-sync/published-layout.v1.json";
export function generateStaticParams() {
  return layout.storefronts.map(({ slug }) => ({ slug }));
}
export default function StorefrontPage() { return <Home />; }
