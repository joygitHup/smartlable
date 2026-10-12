import { ReactNode } from 'react';
import { Activity } from 'lucide-react';

export const FORM = {
  badge: 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
};

const STATUS_META: Record<string, { cls: string; label: string }> = {
  created: { cls: 'bg-slate-100 text-slate-600', label: '待处理' },
  prelabeled: { cls: 'bg-slate-200 text-slate-600', label: '已预标注' },
  auto_approved: { cls: 'bg-emerald-100 text-emerald-700', label: 'AI 自动通过' },
  pending_review: { cls: 'bg-amber-100 text-amber-700', label: '待人工审核' },
  reviewed: { cls: 'bg-blue-100 text-blue-700', label: '已审核' },
  // 任务状态
  importing: { cls: 'bg-slate-100 text-slate-600', label: '导入中' },
  reviewing: { cls: 'bg-indigo-100 text-indigo-700', label: '审核中' },
  completed: { cls: 'bg-emerald-100 text-emerald-700', label: '已完成' },
  archived: { cls: 'bg-slate-200 text-slate-500', label: '已归档' },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { cls: 'bg-slate-100 text-slate-600', label: status };
  return <span className={`${FORM.badge} ${meta.cls}`}>{meta.label}</span>;
}

const TASK_TYPE: Record<string, string> = {
  classification: '文本分类',
  entity: '实体抽取',
  sentiment: '情感分析',
  object_detection: '目标检测',
};

export function TaskTypeTag({ type }: { type: string }) {
  const colors: Record<string, string> = {
    classification: 'bg-violet-50 text-violet-600',
    entity: 'bg-cyan-50 text-cyan-600',
    sentiment: 'bg-rose-50 text-rose-600',
    object_detection: 'bg-sky-50 text-sky-600',
  };
  return <span className={`badge ${colors[type] || 'bg-slate-100 text-slate-600'}`}>{TASK_TYPE[type] || type}</span>;
}

export const PRIORITY_META: Record<string, { cls: string; label: string }> = {
  urgent: { cls: 'bg-rose-100 text-rose-700', label: '紧急' },
  high: { cls: 'bg-orange-100 text-orange-700', label: '高' },
  normal: { cls: 'bg-slate-100 text-slate-600', label: '普通' },
  low: { cls: 'bg-slate-50 text-slate-400', label: '低' },
};

export function ConfidenceBar({
  confidence,
  threshold,
}: {
  confidence: number | null | undefined;
  threshold?: number;
}) {
  if (confidence === null || confidence === undefined) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const pct = Math.round(confidence * 100);
  const low = threshold !== undefined && confidence < threshold;
  const color = low ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`tabular-nums text-xs font-medium ${low ? 'text-amber-600' : 'text-slate-600'}`}>
        {pct}%
      </span>
    </div>
  );
}

export function Stat({
  label,
  value,
  suffix,
  sub,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  sub?: ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tabular-nums text-2xl font-semibold text-slate-900">{value}</span>
        {suffix && <span className="text-sm text-slate-400">{suffix}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function Empty({ text = '暂无数据' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <Activity className="mb-2 h-8 w-8" />
      <div className="text-sm">{text}</div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-slate-400">加载中…</div>
  );
}