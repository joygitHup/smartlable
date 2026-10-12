export interface TaskItem {
  id: number;
  name: string;
  description: string;
  task_type: string;
  task_type_label: string;
  modality: string;
  spec: { labels?: string[]; instructions?: string };
  ai_enabled: boolean;
  confidence_threshold: number;
  manual_review_ratio: number;
  ai_model: string;
  priority: string;
  status: string;
  status_label: string;
  created_by: string;
  created_at: string;
  units_total: number;
  units_status: Record<string, number>;
  recent_units?: UnitItem[];
}

export interface UnitItem {
  id: number;
  task_id: number;
  content: string;
  status: string;
  status_label: string;
  split: string;
  ai_prediction: any;
  confidence: number | null;
  ai_model: string;
  human_label: any;
  human_reviewed: boolean;
  modified_by_human: boolean;
  review_reason: string;
  reviewed_by: string;
  reviewed_at: string | null;
}

export interface QualityData {
  total: number;
  reviewed: number;
  pending_review: number;
  auto_approved: number;
  ai_total: number;
  ai_pass_rate: number;
  ai_agreement: number;
  modify_rate: number;
  kappa: number | null;
  status_counts: Record<string, number>;
  progress_percent: number;
}

export interface ModelItem {
  id: number;
  name: string;
  model_id: string;
  task_type: string;
  description: string;
  metrics: Record<string, number>;
  status: string;
  status_label: string;
  created_by: string;
  created_at: string;
}

export interface DashboardData {
  tasks_total: number;
  units_total: number;
  units_pending_review: number;
  status_counts: Record<string, number>;
  ai_pass_rate: number;
  ai_total: number;
  ai_auto: number;
  modify_rate: number;
  units_reviewed: number;
  units_modified: number;
  models_total: number;
  recent_activity_24h: number;
}