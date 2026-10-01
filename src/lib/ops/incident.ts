export type AdminIncidentInput = {
  route: string;
  feature: string;
  category: "database" | "authorization" | "validation" | "unknown";
  status?: "open" | "resolved";
  safeCode?: string;
};

export type AdminIncident = AdminIncidentInput & {
  id: string;
  timestamp: string;
  environment: string;
  firstDetected: string;
  lastOccurrence: string;
  resolutionStatus: "open" | "resolved";
};

export function recordAdminIncident(input: AdminIncidentInput): AdminIncident {
  const timestamp = new Date().toISOString();
  const incident: AdminIncident = {
    ...input,
    id: globalThis.crypto.randomUUID(),
    timestamp,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    firstDetected: timestamp,
    lastOccurrence: timestamp,
    resolutionStatus: input.status ?? "open",
    safeCode: input.safeCode ?? "ADMIN_DATA",
  };
  console.error("[ivoire-admin-incident]", {
    incidentId: incident.id,
    timestamp: incident.timestamp,
    environment: incident.environment,
    route: incident.route,
    feature: incident.feature,
    errorCategory: incident.category,
    safeErrorCode: incident.safeCode,
    status: incident.resolutionStatus,
    firstDetected: incident.firstDetected,
    lastOccurrence: incident.lastOccurrence,
    resolutionStatus: incident.resolutionStatus,
  });
  return incident;
}
