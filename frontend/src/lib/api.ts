const BASE = "/api";

// ─── Auth Token Management ──────────────────────────────────────
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("auth_token", token);
  } else {
    localStorage.removeItem("auth_token");
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem("auth_token");
  }
  return authToken;
}

export function clearAuth() {
  authToken = null;
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
}

// ─── HTTP Client ────────────────────────────────────────────────
async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Common Types ───────────────────────────────────────────────
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Auth ───────────────────────────────────────────────────────
export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

export const login = (email: string, password: string) =>
  request<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const register = (email: string, password: string, name: string) =>
  request<{ token: string; user: AuthUser }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });

export const getMe = () => request<AuthUser>("/auth/me");

// ─── Profiles ───────────────────────────────────────────────────
export interface Profile {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

export const getProfiles = () =>
  request<Paginated<Profile>>("/profiles").then((r) => r.data);

export const createProfile = (data: { name: string; color?: string }) =>
  request<Profile>("/profiles", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateProfile = (id: number, data: { name: string; color?: string }) =>
  request<Profile>(`/profiles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteProfile = (id: number) =>
  request<{ ok: boolean }>(`/profiles/${id}`, { method: "DELETE" });

// ─── Payslips ───────────────────────────────────────────────────
export interface PayslipConcept {
  id: number;
  payslipId: number;
  category: "devengo" | "deduccion" | "otros";
  name: string;
  amount: number;
  isPercentage: boolean;
}

export interface Payslip {
  id: number;
  profileId: number;
  fileName: string;
  filePath: string;
  periodMonth: number | null;
  periodYear: number | null;
  company: string | null;
  grossSalary: number | null;
  netSalary: number | null;
  parsingStatus: string;
  payslipType: "ordinal" | "extra";
  createdAt: string;
  concepts?: PayslipConcept[];
}

export interface PayslipFilters {
  profileId?: number;
  year?: number;
  search?: string;
  status?: string;
  type?: "ordinal" | "extra";
  page?: number;
  limit?: number;
}

export const getPayslips = (filters: PayslipFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.profileId) params.set("profileId", String(filters.profileId));
  if (filters.year) params.set("year", String(filters.year));
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 20));
  return request<Paginated<Payslip>>(`/payslips?${params}`);
};

export const getPayslip = (id: number) =>
  request<Payslip & { concepts: PayslipConcept[] }>(`/payslips/${id}`);

export const uploadPayslips = async (profileId: number, files: File[], payslipType: "ordinal" | "extra" = "ordinal") => {
  const formData = new FormData();
  formData.append("profileId", String(profileId));
  formData.append("payslipType", payslipType);
  files.forEach((f) => formData.append("files", f));

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/payslips/upload`, {
    method: "POST",
    body: formData,
    headers,
  });
  if (res.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }
  if (!res.ok) throw new Error("Upload failed");
  return res.json() as Promise<Payslip[]>;
};

export const updatePayslipConcepts = (
  id: number,
  data: {
    concepts: Array<{
      category: string;
      name: string;
      amount: number;
      isPercentage?: boolean;
    }>;
    grossSalary?: number;
    netSalary?: number;
    periodMonth?: number;
    periodYear?: number;
    company?: string;
  }
) =>
  request<{ ok: boolean }>(`/payslips/${id}/concepts`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const reprocessPayslip = (id: number) =>
  request<Payslip & { concepts: PayslipConcept[] }>(`/payslips/${id}/reprocess`, {
    method: "POST",
  });

export const deletePayslip = (id: number) =>
  request<{ ok: boolean }>(`/payslips/${id}`, { method: "DELETE" });

export const updatePayslipType = (id: number, type: "ordinal" | "extra") =>
  request<Payslip>(`/payslips/${id}/type`, {
    method: "PATCH",
    body: JSON.stringify({ type }),
  });

// ─── Dashboard ──────────────────────────────────────────────────
export interface AnnualSummary {
  year: number;
  months: number;
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  totalIrpf: number;
  avgMonthlyGross: number;
  avgMonthlyNet: number;
  projectedAnnualGross: number;
  projectedAnnualNet: number;
  pagasExtra: number;
  extraGross: number;
  extraNet: number;
  retentionRate: number;
}

export interface DashboardData {
  kpis: {
    totalPayslips: number;
    avgGross: number;
    avgNet: number;
    totalGrossYear: number;
    totalNetYear: number;
    avgIrpf: number;
    extrasCount: number;
    extrasTotalGross: number;
    extrasTotalNet: number;
  };
  evolution: Record<string, Array<{ month: string; gross: number | null; net: number | null }>>;
  conceptBreakdown: Array<{
    name: string;
    category: string;
    total: number;
    average: number;
    count: number;
  }>;
  annualSummaries: AnnualSummary[];
  irpfEvolution: Array<{ month: string; amount: number; rate: number }>;
  monthlySavings: Array<{ month: string; gross: number; net: number; deductions: number; retentionRate: number }>;
  profiles: Array<{ id: number; name: string; color: string }>;
}

export const getDashboard = (profileIds?: number[], from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (profileIds?.length) params.set("profileId", profileIds.join(","));
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request<DashboardData>(`/dashboard?${params}`);
};

// ─── Analytics ──────────────────────────────────────────────────
export interface AnalyticsData {
  trends: {
    gross: Array<{ month: string; value: number }>;
    net: Array<{ month: string; value: number }>;
    yoyGross: Array<{ month: string; current: number; previous: number; change: number }>;
    yoyNet: Array<{ month: string; current: number; previous: number; change: number }>;
    conceptTrends: Record<string, Array<{ month: string; value: number }>>;
  };
  predictions: Array<{ month: string; predictedGross: number; predictedNet: number }>;
  anomalies: Array<{
    type: string;
    severity: "info" | "warning" | "critical";
    month: string;
    message: string;
    value: number;
    expected: number;
  }>;
  alerts: Array<{
    type: string;
    severity: "info" | "warning" | "critical";
    message: string;
  }>;
  extras: Array<{
    year: number;
    count: number;
    totalGross: number;
    totalNet: number;
  }>;
}

export const getAnalytics = (profileId: number) =>
  request<AnalyticsData>(`/analytics?profileId=${profileId}`);

// ─── Export ─────────────────────────────────────────────────────
export const exportData = async (profileId: number, year?: number, format: "csv" | "json" = "csv") => {
  const params = new URLSearchParams({ profileId: String(profileId), format });
  if (year) params.set("year", String(year));

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/export?${params}`, { headers });
  if (!res.ok) throw new Error("Export failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nominas_${profileId}${year ? `_${year}` : ""}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Notes ──────────────────────────────────────────────────────
export interface Note {
  id: number;
  payslipId: number;
  content: string;
  createdAt: string;
}

export const getNotes = (payslipId: number) =>
  request<Note[]>(`/notes/${payslipId}`);

export const createNote = (payslipId: number, content: string) =>
  request<Note>("/notes", {
    method: "POST",
    body: JSON.stringify({ payslipId, content }),
  });

export const deleteNote = (id: number) =>
  request<{ ok: boolean }>(`/notes/${id}`, { method: "DELETE" });

// ─── Tags ───────────────────────────────────────────────────────
export interface Tag {
  id: number;
  name: string;
  color: string;
}

export const getTags = () => request<Tag[]>("/tags");

export const createTag = (name: string, color: string) =>
  request<Tag>("/tags", {
    method: "POST",
    body: JSON.stringify({ name, color }),
  });

export const deleteTag = (id: number) =>
  request<{ ok: boolean }>(`/tags/${id}`, { method: "DELETE" });

export const getPayslipTags = (payslipId: number) =>
  request<Tag[]>(`/tags/payslip/${payslipId}`);

export const assignTag = (payslipId: number, tagId: number) =>
  request<{ ok: boolean }>(`/tags/payslip/${payslipId}/${tagId}`, { method: "POST" });

export const removeTag = (payslipId: number, tagId: number) =>
  request<{ ok: boolean }>(`/tags/payslip/${payslipId}/${tagId}`, { method: "DELETE" });

// ─── Alerts ─────────────────────────────────────────────────────
export interface AlertRule {
  id: number;
  name: string;
  type: string;
  config: string;
  enabled: number;
  createdAt: string;
}

export interface AlertHistoryItem {
  id: number;
  ruleId: number | null;
  type: string;
  severity: string;
  message: string;
  read: number;
  createdAt: string;
}

export const getAlertRules = () => request<AlertRule[]>("/alerts/rules");

export const createAlertRule = (data: { name: string; type: string; config: Record<string, unknown> }) =>
  request<AlertRule>("/alerts/rules", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteAlertRule = (id: number) =>
  request<{ ok: boolean }>(`/alerts/rules/${id}`, { method: "DELETE" });

export const getAlertHistory = () => request<AlertHistoryItem[]>("/alerts/history");

export const markAlertRead = (id: number) =>
  request<{ ok: boolean }>(`/alerts/history/${id}/read`, { method: "PUT" });

export const markAllAlertsRead = () =>
  request<{ ok: boolean }>("/alerts/history/read-all", { method: "PUT" });
