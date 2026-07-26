import type { CatalogStorage } from "./synchronization";
interface D1Like { prepare(query:string): { bind(...values:unknown[]): { run():Promise<unknown> } } }
export class CloudflareCatalogStorage implements CatalogStorage { constructor(private db:D1Like){} async recordAudit(entry:{merchantId:string;action:string;at:string}) { await this.db.prepare("INSERT INTO catalog_audit (merchant_id, action, created_at) VALUES (?, ?, ?)").bind(entry.merchantId,entry.action,entry.at).run(); } }
