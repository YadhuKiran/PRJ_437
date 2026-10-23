/* Shared domain types — mirror the backend contracts (see backend/app/schemas.py
   and backend/app/routers/). Keep in sync; contract drift is a bug. */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type RiskLevelOrUnavailable = RiskLevel | 'UNAVAILABLE';
export type ReportStatus = 'new' | 'under_review' | 'closed';
export type ReporterType = 'victim' | 'anonymous' | 'third_party';
export type StaffRole = 'admin' | 'case_handler' | 'viewer';

export interface ReportItem {
  id: number;
  case_id: string;
  reporter_type: ReporterType | string;
  location: string;
  incident_date: string;
  status: ReportStatus | string;
  created_at: string;
  /** null when no AI assessment exists yet (never a negative sentinel). */
  risk_score?: number | null;
  risk_level?: RiskLevelOrUnavailable | null;
}

export interface ReportDetail {
  id: number;
  case_id: string;
  reporter_type: ReporterType | string;
  location: string;
  incident_date: string;
  status: ReportStatus | string;
  created_at: string;
  /** Empty for roles that may not read survivor disclosures. */
  contact: string;
  /** Empty for roles that may not read survivor disclosures. */
  description: string;
  /** Present when the payload was restricted by role. */
  restricted?: string;
}

export interface Analysis {
  report_id: number;
  case_id: string;
  risk_score: number | null;
  risk_level: RiskLevelOrUnavailable | null;
  abuse_types: string[];
  threat_detected: boolean | null;
  weapon_mentioned: boolean | null;
  stalking_detected: boolean | null;
  immediate_danger: boolean | null;
  recurring_incident: boolean | null;
  key_indicators: string[];
  ai_summary: string | null;
  ai_available: boolean;
  reasons: string[];
  ai_generated_at: string | null;
  human_override: RiskLevel | null;
  override_reason: string | null;
  override_by: number | null;
  override_at: string | null;
}

export interface AuditEvent {
  id: number;
  actor_id: number | null;
  actor_role: string | null;
  action: string;
  report_id: number | null;
  details: Record<string, unknown>;
  timestamp: string;
}

export type PublicView = 'home' | 'report' | 'track' | 'resources';
export type StaffView = 'dashboard' | 'cases' | 'audit' | 'resources' | 'security';

export interface PagedReports {
  items: ReportItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Session {
  username: string;
  role: StaffRole | string;
  id: number;
}

export interface AiStatus {
  provider: string;
  model: string;
  jev_configured: boolean;
  jev_host: string;
  offline_safe: boolean;
  note: string;
}

export interface AiVerifyResult {
  score: number;
  level: RiskLevel | string;
  reasons: string[];
  indicators: string[];
  meta: Record<string, unknown>;
  narrative_chars: number;
}

export interface SupportResource {
  name: string;
  detail: string;
}

export interface StaffCreateResult {
  username: string;
  role: StaffRole | string;
}
