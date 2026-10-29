import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

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

// ===== 全局 Toast 通知 =====

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  msg: string;
}

const toastListeners = new Set<(t: ToastItem) => void>();
let toastSeq = 1;

function emitToast(kind: ToastKind, msg: string) {
  const item = { id: toastSeq++, kind, msg };
  toastListeners.forEach((fn) => fn(item));
}

export const toast = {
  success: (msg: string) => emitToast('success', msg),
  error: (msg: string) => emitToast('error', msg),
  info: (msg: string) => emitToast('info', msg),
};

const TOAST_META: Record<ToastKind, { cls: string; icon: ReactNode }> = {
  success: {
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />,
  },
  error: {
    cls: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: <XCircle className="mt-0.5 h-4 w-4 flex-none" />,
  },
  info: {
    cls: 'border-slate-200 bg-white text-slate-700',
    icon: <Info className="mt-0.5 h-4 w-4 flex-none" />,
  },
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const fn = (t: ToastItem) => {
      setItems((prev) => [...prev.slice(-4), t]);
      window.setTimeout(() => setItems((prev) => prev.filter((p) => p.id !== t.id)), 3200);
    };
    toastListeners.add(fn);
    return () => {
      toastListeners.delete(fn);
    };
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 max-w-[90vw] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${TOAST_META[t.kind].cls}`}
        >
          {TOAST_META[t.kind].icon}
          <span className="min-w-0 break-words">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ===== 全局二次确认弹窗 =====

export interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** 默认 true：红色危险样式；传 false 使用主色样式 */
  danger?: boolean;
}

interface ConfirmTask {
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
}

let confirmListener: ((task: ConfirmTask) => void) | null = null;

/**
 * 全局二次确认：await confirmDialog({ message: '确认删除？' })
 * 需在布局中挂载 <ConfirmHost />；未挂载时降级为 window.confirm。
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (confirmListener) confirmListener({ opts, resolve });
    else resolve(window.confirm(typeof opts.message === 'string' ? opts.message : '确认执行该操作？'));
  });
}

export function ConfirmHost() {
  const [queue, setQueue] = useState<ConfirmTask[]>([]);

  useEffect(() => {
    confirmListener = (task) => setQueue((q) => [...q, task]);
    return () => {
      confirmListener = null;
    };
  }, []);

  const close = useCallback((v: boolean) => {
    setQueue((q) => {
      const [head, ...rest] = q;
      if (head) head.resolve(v);
      return rest;
    });
  }, []);

  useEffect(() => {
    if (!queue[0]) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queue, close]);

  const current = queue[0];
  if (!current) return null;
  const { opts } = current;
  const danger = opts.danger !== false;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => close(false)} />
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${
              danger ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">
              {opts.title || (danger ? '危险操作确认' : '操作确认')}
            </div>
            <div className="mt-1 text-sm leading-relaxed text-slate-600">{opts.message}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={() => close(false)}>
            {opts.cancelText || '取消'}
          </button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
            {opts.confirmText || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}