export type OperatorSession = { operatorId: string; developmentOnly: boolean };
/** Production must replace this development boundary with a verified platform-operator session. */
export async function operatorSession(request: Request): Promise<OperatorSession | null> {
  if (process.env.NODE_ENV !== "production" && process.env.NUME_ENABLE_DEV_OPERATOR_CONTROL === "1") {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token && token === process.env.NUME_DEV_OPERATOR_TOKEN) return { operatorId: "operator:development", developmentOnly: true };
  }
  return null;
}
