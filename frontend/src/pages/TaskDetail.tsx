import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Users, Database, Download, RefreshCw, FlaskConical, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { TaskItem, UnitItem, QualityData } from '../types';
import {
  StatusBadge,
  TaskTypeTag,
  PRIORITY_META,
  ConfidenceBar,
  Stat,
  Loading,
  Empty,
  toast,
} from '../components/common';

type Tab = 'overview' | 'data' | 'quality';

export default function TaskDetail() {
  const { id } = useParams();
  const tid = Number(id);
  const { hasPerm } = useAuth();
  const [task, setTask] = useState<TaskItem | null>(null);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [quality, setQuality] = useState<QualityData | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState<string>('');
  const [showImport, setShowImport] = useState(false);
  const [goldMsg, setGoldMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    Promise.all([
      api<TaskItem>(`/tasks/${tid}`),
      api<{ items: UnitItem[] }>(`/tasks/${tid}/units?page_size=50`).then((r) => r.items),
    ])
      .then(([t, us]) => {
        setTask(t);
        setUnits(us);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [tid]);

  useEffect(() => {
    load();
  }, [tid]);

  useEffect(() => {
    if (tab === 'quality' || tab === 'overview') {
      api<QualityData>(`/tasks/${tid}/quality`).then(setQuality).catch(() => {});
    }
  }, [tid, tab]);

  const canManage = hasPerm('task:manage');
  const canAI = hasPerm('ai:manage') || hasPerm('task:manage');

  const runAction = async (path: string, method: 'POST' = 'POST', opts: any = {}) => {
    if (busy) return null;
    setBusy(true);
    setBanner('');
    try {
      const data = await api(path, { method, ...opts });
      setBanner(
        data.message
          ? JSON.stringify(data.message)
          : `操作成功：` + (JSON.stringify(data) || '')
      );
      if (data.success === false && data.errors) {
        setBanner(`AI 预标注失败（${(data.errors[0]?.error || '').slice(0, 80)}）`);
      }
      await load();
      return data;
    } catch (e: any) {
      setBanner(`操作失败：${e.message}`);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const runAI = async () => {
    const d = await runAction(`/tasks/${tid}/run-ai`);
    if (d && d.success !== false) toast.success('AI 预标注完成');
    if (d?.success === false) {
      setBanner(`⚠️ AI 预标注暂不可用：${d.message}。可「人工入队」转为纯人工标注，或在导入时带入已有模型预标注结果。`);
    }
  };

  const toReview = async () => {
    const d = await runAction(`/tasks/${tid}/to-review`);
    if (d) toast.success('已加入审核队列');
  };

  const reflow = async () => {
    const d = await runAction(`/tasks/${tid}/reflow`);
    if (d) toast.success('数据回流完成');
  };

  const exportData = async (fmt: 'json' | 'csv') => {
    const d = await runAction(`/tasks/${tid}/export`, 'POST', { body: { format: fmt } });
    if (d) toast.success('导出成功');
    if (d?.content) {
      const blob = new Blob([d.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = d.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const goldCheck = async () => {
    if (busy) return;
    setBusy(true);
    setGoldMsg('');
    try {
      const d = await api(`/tasks/${tid}/gold-check`, { method: 'POST', body: { count: 10 } });
      setGoldMsg(`抽检 ${d.sampled} 条金标，AI 一致率 ${d.ai_accuracy}%，一致 ${d.agree} 条`);
      toast.success('金标抽检完成');
    } catch (e: any) {
      setGoldMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;
  if (!task) return <Empty text={err || '任务不存在'} />;

  const stats = task.units_status || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/tasks" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
            <ArrowLeft className="h-4 w-4" /> 返回任务列表
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{task.name}</h1>
            <TaskTypeTag type={task.task_type} />
            <StatusBadge status={task.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{task.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/tasks/${tid}/label`} className="btn-primary">
            <Users className="h-4 w-4" /> 进入标注台
          </Link>
        </div>
      </div>

      {banner && (
        <div className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">{banner}</div>
      )}

      {/* 操作栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary" onClick={() => setShowImport(true)} disabled={!canManage || busy}>
          <Database className="h-4 w-4" /> 导入数据
        </button>
        {canAI && (
          <button className="btn-secondary" onClick={runAI} disabled={busy}>
            <Sparkles className="h-4 w-4" /> {busy ? '处理中…' : '运行 AI 预标注'}
          </button>
        )}
        {canManage && (
          <button className="btn-secondary" onClick={toReview} disabled={busy}>
            <Play className="h-4 w-4" /> 人工入队（降级）
          </button>
        )}
        {canManage && (
          <button className="btn-secondary" onClick={reflow} disabled={busy}>
            <RefreshCw className="h-4 w-4" /> 数据回流
          </button>
        )}
        {canManage && (
          <>
            <button className="btn-secondary" onClick={() => exportData('json')} disabled={busy}>
              <Download className="h-4 w-4" /> 导出JSON
            </button>
            <button className="btn-secondary" onClick={() => exportData('csv')} disabled={busy}>
              <Download className="h-4 w-4" /> 导出CSV
            </button>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            ['overview', '概览与进度'],
            ['data', '数据样本'],
            ['quality', '质量监控'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === k ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab task={task} stats={stats} />
      )}

      {tab === 'data' && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
            共 <span className="font-medium tabular-nums">{task.units_total}</span> 条样本
          </div>
          {units.length === 0 ? (
            <Empty text="暂无样本，请先导入数据" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">ID</th>
                  <th className="th">内容</th>
                  <th className="th">状态</th>
                  <th className="th">AI 置信度</th>
                  <th className="th">AI 结果</th>
                  <th className="th">人工结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="td tabular-nums text-slate-400">#{u.id}</td>
                    <td className="td max-w-md truncate">{u.content}</td>
                    <td className="td"><StatusBadge status={u.status} /></td>
                    <td className="td"><ConfidenceBar confidence={u.confidence} threshold={task.confidence_threshold} /></td>
                    <td className="td max-w-[10rem] truncate">{labelText(u.ai_prediction)}</td>
                    <td className="td max-w-[10rem] truncate">{u.human_reviewed ? labelText(u.human_label) : <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'quality' && (
        <div className="space-y-4">
          {quality ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="总样本" value={quality.total} />
              <Stat label="已审核" value={quality.reviewed} />
              <Stat label="AI 通过率" value={quality.ai_pass_rate} suffix="%" />
              <Stat label="AI 一致率" value={quality.ai_agreement} suffix="%" />
              <Stat label="人工修正率" value={quality.modify_rate} suffix="%" />
              <Stat label="Kappa 系数" value={quality.kappa ?? '-'} />
              <Stat label="待人工审核" value={quality.pending_review} />
              <Stat label="审核进度" value={quality.progress_percent} suffix="%" />
            </div>
          ) : (
            <Empty text="暂无质量数据" />
          )}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-700">黄金标准集抽检</h3>
                <p className="text-xs text-slate-500">从已审核样本随机抽取作为金标基准，评估 AI 质量</p>
              </div>
              <button className="btn-secondary" onClick={goldCheck} disabled={busy}>
                <FlaskConical className="h-4 w-4" /> {busy ? '处理中…' : '启动抽检'}
              </button>
            </div>
            {goldMsg && <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{goldMsg}</div>}
          </div>
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={load} tid={tid} />}
    </div>
  );
}

function labelText(label: any): string {
  if (!label) return '';
  if (typeof label === 'string') return label;
  if (label.label) return String(label.label);
  if (Array.isArray(label.entities)) return label.entities.map((e: any) => e.text).join('、');
  return JSON.stringify(label);
}

function OverviewTab({ task, stats }: { task: TaskItem; stats: Record<string, number> }) {
  const priority = PRIORITY_META[task.priority];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="样本总数" value={task.units_total} />
        <Stat label="AI 自动通过" value={stats.auto_approved || 0} />
        <Stat label="待人工审核" value={stats.pending_review || 0} />
        <Stat label="已审核" value={stats.reviewed || 0} />
      </div>
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-medium text-slate-700">任务配置</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
          <Row k="任务类型" v={task.task_type_label} />
          <Row k="模态" v={task.modality} />
          <Row k="优先级" v={priority?.label || task.priority} />
          <Row k="是否启用 AI" v={task.ai_enabled ? '是' : '否'} />
          <Row k="置信度阈值" v={`${task.confidence_threshold}`} />
          <Row k="人工复核比例" v={`${task.manual_review_ratio}`} />
          <Row k="AI 模型" v={task.ai_model || '—'} />
          <Row k="创建人" v={task.created_by} />
          <Row k="创建时间" v={formatTime(task.created_at)} />
          <div className="col-span-2 md:col-span-3">
            <span className="text-xs text-slate-400">候选标签：</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(task.spec?.labels || []).map((l) => (
                <span key={l} className="badge bg-indigo-50 text-indigo-600">{l}</span>
              ))}
            </div>
          </div>
          {task.spec?.instructions && (
            <div className="col-span-2 md:col-span-3">
              <span className="text-xs text-slate-400">标注规范：</span>
              <p className="mt-1 rounded-md bg-slate-50 p-2 text-sm text-slate-600">{task.spec.instructions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{k}</div>
      <div className="font-medium text-slate-700">{v}</div>
    </div>
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

function ImportModal({ onClose, onDone, tid }: { onClose: () => void; onDone: () => void; tid: number }) {
  const [text, setText] = useState('');
  const [hasPrelabel, setHasPrelabel] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!text.trim()) return setErr('请粘贴样本内容（每行一条）');
    setSubmitting(true);
    try {
      const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
      const items = hasPrelabel
        ? lines.map((l) => {
            // 支持 "文本 | 标签 | 置信度" 格式，作为已有预标注导入
            const parts = l.split('|').map((s) => s.trim());
            return {
              content: parts[0],
              ai_prediction: parts[1] ? { label: parts[1] } : null,
              confidence: parts[2] !== undefined ? Number(parts[2]) : 0.5,
              ai_model: 'imported-model',
            };
          })
        : lines.map((l) => ({ content: l }));
      await api(`/tasks/${tid}/import`, { method: 'POST', body: { items } });
      toast.success('导入成功');
      onDone();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">导入样本数据</h2>
        <p className="mb-4 text-xs text-slate-500">
          支持每行一条文本；勾选下方选项后可用「文本 | 标签 | 置信度」格式带入已有模型预标注结果。
        </p>
        <textarea
          className="input h-52 font-mono text-xs"
          placeholder={'手机屏幕素质很高，色彩鲜艳。\n快递破损，外包装都压扁了。\n送货很快，物流体验不错。'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={hasPrelabel} onChange={(e) => setHasPrelabel(e.target.checked)} />
          每行按「文本|标签|置信度」携带预标注（模拟已有模型结果导入）
        </label>
        {err && <div className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? '导入中…' : '导入'}
          </button>
        </div>
      </div>
    </div>
  );
}