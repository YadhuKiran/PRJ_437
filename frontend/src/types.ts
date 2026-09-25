/* Shared domain types (mirror backend contracts — do not drift). */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ReportItem {
  id: number;
  case_id: string;
  reporter_type: string;
  location: string;
  incident_date: string;
  status: string;
  created_at: string;
  risk_score?: number | null;
  risk_level?: RiskLevel | null;
}

export interface Analysis {
  report_id: number;
  case_id: string;
  risk_score: number | null;
  risk_level: RiskLevel | 'UNAVAILABLE' | null;
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

export interface AiStatus {
  provider: string;
  model: string;
  jev_configured: boolean;
  jev_host: string;
  key_hint: string;
  offline_safe: boolean;
  note: string;
}
