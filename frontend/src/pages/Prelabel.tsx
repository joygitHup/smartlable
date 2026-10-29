import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Plus,
  X,
  Trash2,
  Pencil,
  RefreshCw,
  Play,
  Sparkles,
  Zap,
  FlaskConical,
  AlertTriangle,
} from 'lucide-react';
import { fetchData, fetchList, api } from '../api';
import { useAuth } from '../auth';
import { Loading, Empty, TaskTypeTag, confirmDialog, toast } from '../components/common';

const TASK_TYPES: [string, string][] = [
  ['classification', '文本分类'],
  ['sentiment', '情感分析'],
  ['entity', '实体抽取'],
  ['object_detection', '目标检测'],
];

interface TaskOption {
  id: number;
  name: string;
  task_type: string;
}

type TabKey = 'thresholds' | 'rules' | 'records' | 'compare' | 'experiments' | 'longtail';

const TABS: [TabKey, string][] = [
  ['thresholds', '类别阈值'],
  ['rules', '规则引擎'],
  ['records', '预标注记录 / 可解释'],
  ['compare', '多模型对比'],
  ['experiments', 'A/B 实验'],
  ['longtail', '长尾类别'],
];

export default function Prelabel() {
  const { isRole } = useAuth();
  const [tab, setTab] = useState<TabKey>('thresholds');
  const [tasks, setTasks] = useState<TaskOption[]>([]);

  useEffect(() => {
    api<TaskOption[]>('/tasks')
      .then(setTasks)
      .catch(() => setTasks([]));
  }, []);

  const canManage = isRole('admin', 'operator', 'engineer', 'pm');
  const canTune = isRole('admin', 'engineer', 'pm');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">AI 预标注增强</h1>
        <p className="text-sm text-slate-500">
          类别阈值动态调优、规则兜底、可解释预标注、多模型对比、A/B 实验与长尾类别专项策略
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(([k, label]) => (
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

      {tab === 'thresholds' && <ThresholdsTab tasks={tasks} canManage={canManage} canTune={canTune} />}
      {tab === 'rules' && <RulesTab canManage={canManage} />}
      {tab === 'records' && <RecordsTab canManage={canManage} />}
      {tab === 'compare' && <CompareTab canManage={canManage} />}
      {tab === 'experiments' && <ExperimentsTab tasks={tasks} canTune={canTune} />}
      {tab === 'longtail' && <LongTailTab canManage={canManage} />}
    </div>
  );
}

/* ---------------- 通用 ---------------- */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrBanner({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
      <span>{msg}</span>
    </div>
  );
}

function OkBanner({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>;
}

function taskName(tasks: TaskOption[], id: number | null): string {
  if (!id) return '—';
  return tasks.find((t) => t.id === id)?.name || `#${id}`;
}

/* ---------------- F10.1/F10.2 类别阈值 ---------------- */

interface ThresholdRow {
  id: number;
  task_id: number | null;
  task_type: string;
  label: string;
  threshold: number;
  auto_tuned: boolean;
  human_correction_rate: number;
  sample_size: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TuneSuggestion {
  threshold_id: number;
  label: string;
  current_threshold: number;
  suggested_threshold: number;
  correction_rate: number;
  sample_size: number;
  basis: string;
  applied: boolean;
}

interface TuneResult {
  task_type: string;
  task_id: number | null;
  suggestions: TuneSuggestion[];
}

function ThresholdsTab({
  tasks,
  canManage,
  canTune,
}: {
  tasks: TaskOption[];
  canManage: boolean;
  canTune: boolean;
}) {
  const [rows, setRows] = useState<ThresholdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<ThresholdRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [tuneMode, setTuneMode] = useState<'task' | 'task_type'>('task_type');
  const [tuneTask, setTuneTask] = useState('');
  const [tuneType, setTuneType] = useState(TASK_TYPES[0][0]);
  const [tuning, setTuning] = useState(false);
  const [tuneMsg, setTuneMsg] = useState('');
  const [tuneErr, setTuneErr] = useState('');
  const [tuneResult, setTuneResult] = useState<TuneResult | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<ThresholdRow>('/prelabel/thresholds?pageSize=100')
      .then((r) => setRows(r.list))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const remove = async (row: ThresholdRow) => {
    if (!(await confirmDialog({ message: `确认删除类别「${row.label}」的阈值配置？` }))) return;
    setErr('');
    try {
      await fetchData(`/prelabel/thresholds/${row.id}`, { method: 'DELETE' });
      toast.success(`已删除类别「${row.label}」的阈值配置`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const runTune = async () => {
    setTuning(true);
    setTuneErr('');
    setTuneMsg('');
    setTuneResult(null);
    try {
      const body = tuneMode === 'task' ? { task: Number(tuneTask), write_back: true } : { task_type: tuneType, write_back: true };
      const r = await fetchData<TuneResult>('/prelabel/thresholds/tune', { method: 'POST', body });
      setTuneResult(r);
      setTuneMsg(`调优完成，共 ${r.suggestions.length} 个类别，已回写 ${r.suggestions.filter((s) => s.applied).length} 项`);
      toast.success('阈值调优完成');
      load();
    } catch (e: any) {
      setTuneErr(e.message);
    } finally {
      setTuning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Sparkles className="h-4 w-4 text-indigo-500" /> 阈值动态调优
          <span className="text-xs font-normal text-slate-400">按人工修正率推算建议阈值（样本量不足时保持基础阈值）</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">调优范围</label>
            <select className="input w-40" value={tuneMode} onChange={(e) => setTuneMode(e.target.value as 'task' | 'task_type')}>
              <option value="task_type">按任务类型</option>
              <option value="task">按任务</option>
            </select>
          </div>
          {tuneMode === 'task_type' ? (
            <div>
              <label className="label">任务类型</label>
              <select className="input w-40" value={tuneType} onChange={(e) => setTuneType(e.target.value)}>
                {TASK_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">标注任务</label>
              <select className="input w-64" value={tuneTask} onChange={(e) => setTuneTask(e.target.value)}>
                <option value="">请选择任务</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          <button className="btn-primary" onClick={runTune} disabled={!canTune || tuning || (tuneMode === 'task' && !tuneTask)}>
            <RefreshCw className="h-4 w-4" /> {tuning ? '调优中…' : '开始调优'}
          </button>
        </div>
        {!canTune && <p className="mt-2 text-xs text-slate-400">当前角色无调优权限（需算法工程师/项目经理及以上）</p>}
        <div className="mt-3 space-y-2">
          <ErrBanner msg={tuneErr} />
          <OkBanner msg={tuneMsg} />
          {tuneResult && tuneResult.suggestions.length > 0 && (
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">类别</th>
                    <th className="th">当前阈值</th>
                    <th className="th">建议阈值</th>
                    <th className="th">修正率</th>
                    <th className="th">样本量</th>
                    <th className="th">已应用</th>
                    <th className="th">依据</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tuneResult.suggestions.map((s) => (
                    <tr key={s.threshold_id}>
                      <td className="td font-medium text-slate-700">{s.label}</td>
                      <td className="td tabular-nums">{s.current_threshold}</td>
                      <td className="td tabular-nums font-medium text-indigo-600">{s.suggested_threshold}</td>
                      <td className="td tabular-nums">{(s.correction_rate * 100).toFixed(1)}%</td>
                      <td className="td tabular-nums">{s.sample_size}</td>
                      <td className="td">
                        {s.applied ? (
                          <span className="badge bg-emerald-100 text-emerald-700">是</span>
                        ) : (
                          <span className="badge bg-slate-100 text-slate-500">否</span>
                        )}
                      </td>
                      <td className="td text-xs text-slate-500">{s.basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <ErrBanner msg={err} />
        {canManage && (
          <div className="flex justify-end">
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" /> 新增类别阈值
            </button>
          </div>
        )}
        <div className="card overflow-hidden">
          {loading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty text="暂无类别阈值配置，可先执行阈值调优或手动新增" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">任务类型</th>
                  <th className="th">类别</th>
                  <th className="th">阈值</th>
                  <th className="th">自动调优</th>
                  <th className="th">人工修正率</th>
                  <th className="th">样本量</th>
                  <th className="th">适用范围</th>
                  {canManage && <th className="th text-right">操作</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td"><TaskTypeTag type={r.task_type} /></td>
                    <td className="td font-medium text-slate-700">{r.label}</td>
                    <td className="td tabular-nums">{r.threshold}</td>
                    <td className="td">
                      {r.auto_tuned ? (
                        <span className="badge bg-indigo-50 text-indigo-600">已自动调优</span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-500">手动</span>
                      )}
                    </td>
                    <td className="td tabular-nums">{(r.human_correction_rate * 100).toFixed(1)}%</td>
                    <td className="td tabular-nums">{r.sample_size}</td>
                    <td className="td text-xs text-slate-500">{r.task_id ? taskName(tasks, r.task_id) : '全部任务'}</td>
                    {canManage && (
                      <td className="td text-right">
                        <button
                          className="mr-2 text-slate-400 hover:text-indigo-600"
                          onClick={() => {
                            setEditing(r);
                            setShowForm(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="text-slate-400 hover:text-rose-600" onClick={() => remove(r)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <ThresholdForm
          row={editing}
          tasks={tasks}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ThresholdForm({
  row,
  tasks,
  onClose,
  onSaved,
}: {
  row: ThresholdRow | null;
  tasks: TaskOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    task: row?.task_id ? String(row.task_id) : '',
    task_type: row?.task_type || TASK_TYPES[0][0],
    label: row?.label || '',
    threshold: row ? String(row.threshold) : '0.8',
    auto_tuned: row?.auto_tuned ?? false,
    human_correction_rate: row ? String(row.human_correction_rate) : '0',
    sample_size: row ? String(row.sample_size) : '0',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!form.label.trim()) return setErr('请填写类别名称');
    setBusy(true);
    try {
      const body = {
        task: form.task ? Number(form.task) : null,
        task_type: form.task_type,
        label: form.label.trim(),
        threshold: Number(form.threshold),
        auto_tuned: form.auto_tuned,
        human_correction_rate: Number(form.human_correction_rate),
        sample_size: Number(form.sample_size),
      };
      if (row) {
        await fetchData(`/prelabel/thresholds/${row.id}`, { method: 'PATCH', body });
      } else {
        await fetchData('/prelabel/thresholds', { method: 'POST', body });
      }
      toast.success(row ? '类别阈值已保存' : '类别阈值已创建');
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={row ? '编辑类别阈值' : '新增类别阈值'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">标注任务（可选，留空表示适用范围为全部任务）</label>
          <select className="input" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })}>
            <option value="">全部任务</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">任务类型</label>
            <select className="input" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>
              {TASK_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">类别 *</label>
            <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">阈值 (0~1)</label>
            <input className="input" type="number" step="0.01" min="0" max="1" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
          </div>
          <div>
            <label className="label">人工修正率</label>
            <input className="input" type="number" step="0.01" min="0" max="1" value={form.human_correction_rate} onChange={(e) => setForm({ ...form, human_correction_rate: e.target.value })} />
          </div>
          <div>
            <label className="label">样本量</label>
            <input className="input" type="number" min="0" value={form.sample_size} onChange={(e) => setForm({ ...form, sample_size: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.auto_tuned} onChange={(e) => setForm({ ...form, auto_tuned: e.target.checked })} />
          标记为自动调优
        </label>
        <ErrBanner msg={err} />
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- F10.6 规则引擎 ---------------- */

interface RuleRow {
  id: number;
  task_type: string;
  name: string;
  rule_type: string;
  rule_type_label: string;
  pattern: string;
  label: string;
  priority: number;
  enabled: boolean;
  created_by: string;
  created_at: string;
}

interface ApplyResult {
  hit: boolean;
  unit_id: number;
  label?: string;
  rule_id?: number;
  record_id?: number;
  spans?: Span[];
  reason?: string;
}

interface Span {
  start: number;
  end: number;
  text?: string;
}

function RulesTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<RuleRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [unit, setUnit] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyErr, setApplyErr] = useState('');
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<RuleRow>('/prelabel/rules?pageSize=100')
      .then((r) => setRows(r.list))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const remove = async (row: RuleRow) => {
    if (!(await confirmDialog({ message: `确认删除规则「${row.name}」？` }))) return;
    setErr('');
    try {
      await fetchData(`/prelabel/rules/${row.id}`, { method: 'DELETE' });
      toast.success(`已删除规则「${row.name}」`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const applyRules = async () => {
    setApplying(true);
    setApplyErr('');
    setApplyResult(null);
    try {
      const r = await fetchData<ApplyResult>('/prelabel/apply-rules', { method: 'POST', body: { unit: Number(unit) } });
      setApplyResult(r);
      toast.success('规则应用完成');
    } catch (e: any) {
      setApplyErr(e.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Zap className="h-4 w-4 text-amber-500" /> 规则兜底试跑
          <span className="text-xs font-normal text-slate-400">按优先级匹配关键词/正则，命中即直接赋予标签</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">数据单元 ID</label>
            <input className="input w-40" type="number" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="如 12" />
          </div>
          <button className="btn-primary" onClick={applyRules} disabled={!canManage || applying || !unit}>
            <Play className="h-4 w-4" /> {applying ? '执行中…' : '应用规则'}
          </button>
        </div>
        {!canManage && <p className="mt-2 text-xs text-slate-400">当前角色无执行权限（需运营及以上）</p>}
        <div className="mt-3 space-y-2">
          <ErrBanner msg={applyErr} />
          {applyResult && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              {applyResult.hit ? (
                <div className="space-y-1">
                  <div className="font-medium text-emerald-700">
                    命中规则 #{applyResult.rule_id}，标签「{applyResult.label}」
                  </div>
                  {applyResult.spans && applyResult.spans.length > 0 && (
                    <div className="text-xs text-slate-500">
                      命中片段：{applyResult.spans.map((s) => s.text).join('、')}
                    </div>
                  )}
                  <div className="text-xs text-slate-400">已生成预标注记录 #{applyResult.record_id}</div>
                </div>
              ) : (
                <div className="text-slate-500">未命中任何规则{applyResult.reason ? `：${applyResult.reason}` : ''}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <ErrBanner msg={err} />
        {canManage && (
          <div className="flex justify-end">
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" /> 新增规则
            </button>
          </div>
        )}
        <div className="card overflow-hidden">
          {loading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty text="暂无规则，可新增关键词/正则规则作为预标注兜底" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">名称</th>
                  <th className="th">任务类型</th>
                  <th className="th">类型</th>
                  <th className="th">匹配模式</th>
                  <th className="th">命中标签</th>
                  <th className="th">优先级</th>
                  <th className="th">状态</th>
                  {canManage && <th className="th text-right">操作</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-700">{r.name}</td>
                    <td className="td"><TaskTypeTag type={r.task_type} /></td>
                    <td className="td"><span className="badge bg-slate-100 text-slate-600">{r.rule_type_label}</span></td>
                    <td className="td"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{r.pattern}</code></td>
                    <td className="td">{r.label}</td>
                    <td className="td tabular-nums">{r.priority}</td>
                    <td className="td">
                      {r.enabled ? (
                        <span className="badge bg-emerald-100 text-emerald-700">启用</span>
                      ) : (
                        <span className="badge bg-slate-200 text-slate-500">停用</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="td text-right">
                        <button
                          className="mr-2 text-slate-400 hover:text-indigo-600"
                          onClick={() => {
                            setEditing(r);
                            setShowForm(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="text-slate-400 hover:text-rose-600" onClick={() => remove(r)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <RuleForm
          row={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function RuleForm({ row, onClose, onSaved }: { row: RuleRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    task_type: row?.task_type || TASK_TYPES[0][0],
    name: row?.name || '',
    rule_type: row?.rule_type || 'keyword',
    pattern: row?.pattern || '',
    label: row?.label || '',
    priority: row ? String(row.priority) : '0',
    enabled: row?.enabled ?? true,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!form.name.trim()) return setErr('请填写规则名称');
    if (!form.pattern.trim()) return setErr('请填写匹配模式');
    if (!form.label.trim()) return setErr('请填写命中标签');
    setBusy(true);
    try {
      const body = {
        task_type: form.task_type,
        name: form.name.trim(),
        rule_type: form.rule_type,
        pattern: form.pattern,
        label: form.label.trim(),
        priority: Number(form.priority),
        enabled: form.enabled,
      };
      if (row) {
        await fetchData(`/prelabel/rules/${row.id}`, { method: 'PATCH', body });
      } else {
        await fetchData('/prelabel/rules', { method: 'POST', body });
      }
      toast.success(row ? '规则已保存' : '规则已创建');
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={row ? '编辑规则' : '新增规则'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">任务类型</label>
            <select className="input" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>
              {TASK_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">规则名称 *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">规则类型</label>
            <select className="input" value={form.rule_type} onChange={(e) => setForm({ ...form, rule_type: e.target.value })}>
              <option value="keyword">关键词</option>
              <option value="regex">正则</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">{form.rule_type === 'regex' ? '正则表达式 *' : '关键词 *'}</label>
            <input className="input" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="label">命中标签 *</label>
            <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div>
            <label className="label">优先级</label>
            <input className="input" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          启用该规则
        </label>
        <ErrBanner msg={err} />
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- F10.3/F10.4/F10.5 记录 / 可解释 ---------------- */

interface RecordRow {
  id: number;
  unit_id: number | null;
  task_id: number | null;
  chosen_model: string;
  status: string;
  status_label: string;
  fallback_reason: string;
  created_at: string;
  updated_at: string;
}

interface RecordDetail extends RecordRow {
  candidates: Candidate[];
  explanation: Record<string, any>;
}

interface Candidate {
  model?: string;
  prediction?: any;
  confidence?: number | null;
}

interface RuleMatch {
  rule_id: number;
  rule_name: string;
  rule_type: string;
  label: string;
  pattern: string;
  spans: Span[];
}

interface ExplainResult {
  unit_id: number;
  task_id: number;
  task_type: string;
  content: string;
  ai_prediction: any;
  confidence: number | null;
  ai_model: string;
  status: string;
  rule_matches: RuleMatch[];
  explanation: Record<string, any>;
  candidates: Candidate[];
  chosen_model: string;
  record_id: number | null;
}

function RecordsTab({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [detail, setDetail] = useState<RecordDetail | null>(null);

  const [unit, setUnit] = useState('');
  const [explain, setExplain] = useState<ExplainResult | null>(null);
  const [explainErr, setExplainErr] = useState('');
  const [explainBusy, setExplainBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [fallbackMsg, setFallbackMsg] = useState('');
  const [fallbackErr, setFallbackErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const q = status ? `&status=${status}` : '';
    fetchList<RecordRow>(`/prelabel/records?pageSize=50${q}`)
      .then((r) => setRows(r.list))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [status]);
  useEffect(load, [load]);

  const loadDetail = async (id: number) => {
    setErr('');
    try {
      const d = await fetchData<RecordDetail>(`/prelabel/records/${id}`);
      setDetail(d);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const runExplain = async () => {
    setExplainBusy(true);
    setExplainErr('');
    setExplain(null);
    try {
      const r = await fetchData<ExplainResult>(`/prelabel/explain?unit=${unit}`);
      setExplain(r);
      load();
    } catch (e: any) {
      setExplainErr(e.message);
    } finally {
      setExplainBusy(false);
    }
  };

  const runFallback = async () => {
    setFallbackErr('');
    setFallbackMsg('');
    try {
      const r = await fetchData<{ record_id: number; unit_id: number; unit_status: string; fallback_reason: string }>(
        '/prelabel/fallback',
        { method: 'POST', body: { unit: Number(unit), fallback_reason: reason } }
      );
      setFallbackMsg(`已降级：记录 #${r.record_id}，单元状态 ${r.unit_status}，原因「${r.fallback_reason}」`);
      toast.success('已降级为人工审核');
      load();
    } catch (e: any) {
      setFallbackErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Sparkles className="h-4 w-4 text-indigo-500" /> 可解释性 / 失败降级
          <span className="text-xs font-normal text-slate-400">查看规则命中片段与多模型解释；预标注失败可一键降级人工审核</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">数据单元 ID</label>
            <input className="input w-40" type="number" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="如 12" />
          </div>
          <button className="btn-primary" onClick={runExplain} disabled={explainBusy || !unit}>
            {explainBusy ? '分析中…' : '查看解释'}
          </button>
          {canManage && (
            <>
              <div>
                <label className="label">降级原因</label>
                <input className="input w-64" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="AI 预标注失败，降级人工审核" />
              </div>
              <button className="btn-secondary" onClick={runFallback} disabled={!unit}>
                <AlertTriangle className="h-4 w-4" /> 降级为人工审核
              </button>
            </>
          )}
        </div>
        <div className="mt-3 space-y-2">
          <ErrBanner msg={explainErr} />
          <ErrBanner msg={fallbackErr} />
          <OkBanner msg={fallbackMsg} />
          {explain && (
            <div className="space-y-3 rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                <span>任务 #{explain.task_id}</span>
                <span>状态 {explain.status}</span>
                <span>模型 {explain.ai_model || '—'}</span>
                <span>置信度 {explain.confidence ?? '—'}</span>
                <span>记录 #{explain.record_id ?? '—'}</span>
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-400">原文（高亮为规则命中片段）：</div>
                <Highlighted
                  content={explain.content}
                  spans={explain.rule_matches.flatMap((m) => m.spans || [])}
                />
              </div>
              {explain.rule_matches.length > 0 && (
                <div>
                  <div className="mb-1 text-xs text-slate-400">规则命中：</div>
                  <div className="flex flex-wrap gap-2">
                    {explain.rule_matches.map((m) => (
                      <span key={m.rule_id} className="badge bg-amber-50 text-amber-700">
                        {m.rule_name} → {m.label}（{m.rule_type}）
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-slate-500">
                <span className="text-slate-400">解释信息：</span>
                <code className="ml-1 break-all rounded bg-slate-50 px-1 py-0.5">{JSON.stringify(explain.explanation)}</code>
              </div>
              {explain.candidates.length > 0 && (
                <div>
                  <div className="mb-1 text-xs text-slate-400">候选结果（{explain.chosen_model || '—'} 胜出）：</div>
                  <CandidateTable candidates={explain.candidates} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="label mb-0">状态过滤</label>
            <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部</option>
              <option value="success">已预标注</option>
              <option value="fallback">降级待审</option>
              <option value="failed">预标注失败</option>
            </select>
          </div>
        </div>
        <ErrBanner msg={err} />
        <div className="card overflow-hidden">
          {loading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty text="暂无预标注记录" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">记录</th>
                  <th className="th">单元</th>
                  <th className="th">采用模型</th>
                  <th className="th">状态</th>
                  <th className="th">降级原因</th>
                  <th className="th">时间</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td tabular-nums text-slate-400">#{r.id}</td>
                    <td className="td tabular-nums">#{r.unit_id ?? '—'}</td>
                    <td className="td">{r.chosen_model || '—'}</td>
                    <td className="td">
                      <span className={`badge ${r.status === 'success' ? 'bg-emerald-100 text-emerald-700' : r.status === 'fallback' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {r.status_label}
                      </span>
                    </td>
                    <td className="td max-w-xs truncate text-xs text-slate-500">{r.fallback_reason || '—'}</td>
                    <td className="td whitespace-nowrap text-xs text-slate-400">{r.created_at.slice(0, 16).replace('T', ' ')}</td>
                    <td className="td text-right">
                      <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => loadDetail(r.id)}>
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {detail && (
        <Modal title={`预标注记录 #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
              <div>单元：#{detail.unit_id ?? '—'}</div>
              <div>任务：#{detail.task_id ?? '—'}</div>
              <div>采用模型：{detail.chosen_model || '—'}</div>
              <div>状态：{detail.status_label}</div>
            </div>
            {detail.fallback_reason && <div className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">降级原因：{detail.fallback_reason}</div>}
            <div>
              <div className="mb-1 text-xs text-slate-400">候选结果：</div>
              {detail.candidates.length ? <CandidateTable candidates={detail.candidates} /> : <span className="text-xs text-slate-400">无</span>}
            </div>
            <div className="text-xs text-slate-500">
              <span className="text-slate-400">解释信息：</span>
              <code className="ml-1 break-all rounded bg-slate-50 px-1 py-0.5">{JSON.stringify(detail.explanation)}</code>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CandidateTable({ candidates }: { candidates: Candidate[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="th">模型</th>
            <th className="th">预测</th>
            <th className="th">置信度</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {candidates.map((c, i) => (
            <tr key={i}>
              <td className="td">{c.model || '—'}</td>
              <td className="td max-w-xs truncate text-xs text-slate-600">{JSON.stringify(c.prediction)}</td>
              <td className="td tabular-nums">{c.confidence ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Highlighted({ content, spans }: { content: string; spans: Span[] }) {
  const sorted = [...spans]
    .filter((s) => typeof s.start === 'number' && typeof s.end === 'number' && s.end > s.start)
    .sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((s, i) => {
    if (s.start > cursor) parts.push(<span key={`t${i}`}>{content.slice(cursor, s.start)}</span>);
    if (s.start < cursor) return;
    parts.push(
      <mark key={`m${i}`} className="rounded bg-amber-200 px-0.5 text-slate-800">
        {content.slice(s.start, s.end)}
      </mark>
    );
    cursor = s.end;
  });
  if (cursor < content.length) parts.push(<span key="tail">{content.slice(cursor)}</span>);
  return <p className="whitespace-pre-wrap break-words rounded-md bg-slate-50 p-2 text-sm text-slate-700">{parts}</p>;
}

/* ---------------- F10.5 多模型对比 ---------------- */

interface CompareResult {
  record_id: number;
  unit_id: number;
  candidates: Candidate[];
  chosen_model: string;
  agreement: boolean;
}

function CompareTab({ canManage }: { canManage: boolean }) {
  const [unit, setUnit] = useState('');
  const [candidatesText, setCandidatesText] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const runGet = async () => {
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const r = await fetchData<CompareResult>(`/prelabel/compare?unit=${unit}`);
      setResult(r);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runPost = async () => {
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      let candidates: any = undefined;
      if (candidatesText.trim()) {
        try {
          candidates = JSON.parse(candidatesText);
        } catch {
          throw new Error('候选结果 JSON 格式错误');
        }
      }
      const r = await fetchData<CompareResult>('/prelabel/compare', { method: 'POST', body: { unit: Number(unit), candidates } });
      setResult(r);
      toast.success('对比完成');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <FlaskConical className="h-4 w-4 text-violet-500" /> 多模型结果对比
          <span className="text-xs font-normal text-slate-400">留空候选则调用真实模型推理（模型不可用时会返回 503，如实报错）</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">数据单元 ID</label>
            <input className="input w-40" type="number" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="如 12" />
          </div>
          <button className="btn-secondary" onClick={runGet} disabled={busy || !unit}>
            <RefreshCw className="h-4 w-4" /> 读取已有候选
          </button>
          <button className="btn-primary" onClick={runPost} disabled={!canManage || busy || !unit}>
            <Sparkles className="h-4 w-4" /> 运行对比
          </button>
        </div>
        {!canManage && <p className="mt-2 text-xs text-slate-400">当前角色无执行权限（需运营及以上）</p>}
        <div className="mt-3">
          <label className="label">候选结果（可选，JSON 数组，每个元素含 model / prediction / confidence 字段）</label>
          <textarea
            className="input h-24 font-mono text-xs"
            value={candidatesText}
            onChange={(e) => setCandidatesText(e.target.value)}
            placeholder='[{"model":"glm-4","prediction":{"label":"正向"},"confidence":0.92}]'
          />
        </div>
        <div className="mt-3 space-y-2">
          <ErrBanner msg={err} />
        </div>
      </div>

      {result && (
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>单元 #{result.unit_id}</span>
            <span>记录 #{result.record_id}</span>
            <span>
              采用模型：<span className="font-medium text-indigo-600">{result.chosen_model || '—'}</span>
            </span>
            <span className={`badge ${result.agreement ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {result.agreement ? '模型一致' : '模型不一致'}
            </span>
          </div>
          {result.candidates.length ? <CandidateTable candidates={result.candidates} /> : <Empty text="暂无候选结果" />}
        </div>
      )}
    </div>
  );
}

/* ---------------- F10.7 A/B 实验 ---------------- */

interface ExperimentRow {
  id: number;
  task_id: number;
  task_name: string;
  name: string;
  model_a: string;
  model_b: string;
  status: string;
  status_label: string;
  split_ratio: number;
  winner: string;
  created_by: string;
  created_at: string;
}

interface ArmMetrics {
  unit_ids?: number[];
  sample_size?: number;
  reviewed?: number;
  agree?: number;
  agreement_accuracy?: number | null;
}

interface ExperimentDetail extends ExperimentRow {
  result_a: ArmMetrics;
  result_b: ArmMetrics;
}

const WINNER_LABEL: Record<string, string> = { a: '模型 A 胜出', b: '模型 B 胜出', tie: '平局' };

function ExperimentsTab({ tasks, canTune }: { tasks: TaskOption[]; canTune: boolean }) {
  const [rows, setRows] = useState<ExperimentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<ExperimentDetail | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<ExperimentRow>('/prelabel/experiments?pageSize=100')
      .then((r) => setRows(r.list))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const run = async (row: ExperimentRow) => {
    setErr('');
    setActionMsg('');
    try {
      const d = await fetchData<ExperimentDetail>(`/prelabel/experiments/${row.id}/run`, { method: 'POST' });
      setDetail(d);
      setActionMsg(`实验「${d.name}」已运行，样本已按 A 组比例 ${d.split_ratio} 分组`);
      toast.success(`实验「${d.name}」已运行`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const finish = async (row: ExperimentRow) => {
    setErr('');
    setActionMsg('');
    try {
      const d = await fetchData<ExperimentDetail>(`/prelabel/experiments/${row.id}/finish`, { method: 'POST' });
      setDetail(d);
      setActionMsg(`实验已结束，结果：${WINNER_LABEL[d.winner] || d.winner}`);
      toast.success(`实验已结束：${WINNER_LABEL[d.winner] || d.winner}`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-end">
          {canTune && (
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> 新建实验
            </button>
          )}
        </div>
        <ErrBanner msg={err} />
        <OkBanner msg={actionMsg} />
        <div className="card overflow-hidden">
          {loading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty text="暂无 A/B 实验" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">实验</th>
                  <th className="th">任务</th>
                  <th className="th">模型对比</th>
                  <th className="th">A 组比例</th>
                  <th className="th">状态</th>
                  <th className="th">胜出</th>
                  <th className="th text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-700">{r.name}</td>
                    <td className="td max-w-xs truncate text-sm text-slate-500">{r.task_name}</td>
                    <td className="td text-xs text-slate-600">
                      {r.model_a} <span className="text-slate-300">vs</span> {r.model_b}
                    </td>
                    <td className="td tabular-nums">{r.split_ratio}</td>
                    <td className="td">
                      <span className={`badge ${r.status === 'running' ? 'bg-indigo-100 text-indigo-700' : r.status === 'finished' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.status_label}
                      </span>
                    </td>
                    <td className="td text-xs text-slate-600">{r.winner ? WINNER_LABEL[r.winner] || r.winner : '—'}</td>
                    <td className="td text-right whitespace-nowrap">
                      <button className="mr-2 text-xs font-medium text-indigo-600 hover:underline" onClick={() => viewDetail(r.id, setDetail, setErr)}>
                        结果
                      </button>
                      {canTune && r.status !== 'finished' && (
                        <button className="mr-2 text-xs font-medium text-slate-600 hover:underline" onClick={() => run(r)}>
                          运行
                        </button>
                      )}
                      {canTune && r.status === 'running' && (
                        <button className="text-xs font-medium text-emerald-600 hover:underline" onClick={() => finish(r)}>
                          结束
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {detail && <ExperimentResult detail={detail} onClose={() => setDetail(null)} />}

      {showForm && (
        <ExperimentForm
          tasks={tasks}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

async function viewDetail(id: number, setDetail: (d: ExperimentDetail) => void, setErr: (s: string) => void) {
  setErr('');
  try {
    const d = await fetchData<ExperimentDetail>(`/prelabel/experiments/${id}`);
    setDetail(d);
  } catch (e: any) {
    setErr(e.message);
  }
}

function ExperimentResult({ detail, onClose }: { detail: ExperimentDetail; onClose: () => void }) {
  const arm = (label: string, m: ArmMetrics) => (
    <div className="flex-1 rounded-md border border-slate-200 p-3">
      <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
      <div className="grid grid-cols-2 gap-y-1 text-xs text-slate-500">
        <span>样本量</span>
        <span className="tabular-nums text-slate-700">{m.sample_size ?? '—'}</span>
        <span>已复核</span>
        <span className="tabular-nums text-slate-700">{m.reviewed ?? '—'}</span>
        <span>一致数</span>
        <span className="tabular-nums text-slate-700">{m.agree ?? '—'}</span>
        <span>一致率</span>
        <span className="tabular-nums font-medium text-indigo-600">
          {m.agreement_accuracy != null ? `${(m.agreement_accuracy * 100).toFixed(1)}%` : '—'}
        </span>
      </div>
    </div>
  );
  return (
    <Modal title={`实验结果：${detail.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="text-xs text-slate-500">
          {detail.model_a} vs {detail.model_b} · A 组比例 {detail.split_ratio}
          {detail.winner && <span className="ml-2 font-medium text-emerald-600">{WINNER_LABEL[detail.winner] || detail.winner}</span>}
        </div>
        <div className="flex gap-3">
          {arm(`A：${detail.model_a}`, detail.result_a || {})}
          {arm(`B：${detail.model_b}`, detail.result_b || {})}
        </div>
      </div>
    </Modal>
  );
}

function ExperimentForm({ tasks, onClose, onSaved }: { tasks: TaskOption[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    task: '',
    name: '',
    model_a: '',
    model_b: '',
    split_ratio: '0.5',
    status: 'draft',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!form.task) return setErr('请选择标注任务');
    if (!form.name.trim()) return setErr('请填写实验名称');
    if (!form.model_a.trim() || !form.model_b.trim()) return setErr('请填写对比的两个模型');
    setBusy(true);
    try {
      await fetchData('/prelabel/experiments', {
        method: 'POST',
        body: {
          task: Number(form.task),
          name: form.name.trim(),
          model_a: form.model_a.trim(),
          model_b: form.model_b.trim(),
          split_ratio: Number(form.split_ratio),
          status: form.status,
        },
      });
      toast.success(form.status === 'running' ? '实验已创建并启动' : '实验已创建');
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="新建 A/B 实验" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">标注任务 *</label>
          <select className="input" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })}>
            <option value="">请选择任务</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">实验名称 *</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">模型 A *</label>
            <input className="input" value={form.model_a} onChange={(e) => setForm({ ...form, model_a: e.target.value })} placeholder="如 glm-4" />
          </div>
          <div>
            <label className="label">模型 B *</label>
            <input className="input" value={form.model_b} onChange={(e) => setForm({ ...form, model_b: e.target.value })} placeholder="如 qwen-max" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">A 组比例 (0~1)</label>
            <input className="input" type="number" step="0.1" min="0" max="1" value={form.split_ratio} onChange={(e) => setForm({ ...form, split_ratio: e.target.value })} />
          </div>
          <div>
            <label className="label">初始状态</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">草稿</option>
              <option value="running">进行中</option>
            </select>
          </div>
        </div>
        <ErrBanner msg={err} />
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? '创建中…' : '创建'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- F10.8 长尾类别 ---------------- */

interface LongTailRow {
  id: number;
  task_type: string;
  label: string;
  strategy: string;
  strategy_label: string;
  min_confidence: number;
  notes: string;
  created_by: string;
  created_at: string;
}

const STRATEGIES: [string, string][] = [
  ['oversample', '过采样'],
  ['extra_review', '加严复核'],
  ['manual_only', '仅人工'],
];

function LongTailTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<LongTailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<LongTailRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<LongTailRow>('/prelabel/long-tail?pageSize=100')
      .then((r) => setRows(r.list))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const remove = async (row: LongTailRow) => {
    if (!(await confirmDialog({ message: `确认删除长尾类别「${row.label}」的策略？` }))) return;
    setErr('');
    try {
      await fetchData(`/prelabel/long-tail/${row.id}`, { method: 'DELETE' });
      toast.success(`已删除长尾类别「${row.label}」的策略`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {canManage && (
          <div className="flex justify-end">
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" /> 新增长尾策略
            </button>
          </div>
        )}
        <ErrBanner msg={err} />
        <div className="card overflow-hidden">
          {loading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty text="暂无长尾类别策略" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">任务类型</th>
                  <th className="th">长尾类别</th>
                  <th className="th">策略</th>
                  <th className="th">最低置信度</th>
                  <th className="th">备注</th>
                  {canManage && <th className="th text-right">操作</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td"><TaskTypeTag type={r.task_type} /></td>
                    <td className="td font-medium text-slate-700">{r.label}</td>
                    <td className="td">
                      <span className={`badge ${r.strategy === 'manual_only' ? 'bg-rose-50 text-rose-600' : r.strategy === 'extra_review' ? 'bg-amber-50 text-amber-700' : 'bg-cyan-50 text-cyan-600'}`}>
                        {r.strategy_label}
                      </span>
                    </td>
                    <td className="td tabular-nums">{r.min_confidence}</td>
                    <td className="td max-w-xs truncate text-xs text-slate-500">{r.notes || '—'}</td>
                    {canManage && (
                      <td className="td text-right">
                        <button
                          className="mr-2 text-slate-400 hover:text-indigo-600"
                          onClick={() => {
                            setEditing(r);
                            setShowForm(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="text-slate-400 hover:text-rose-600" onClick={() => remove(r)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <LongTailForm
          row={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function LongTailForm({ row, onClose, onSaved }: { row: LongTailRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    task_type: row?.task_type || TASK_TYPES[0][0],
    label: row?.label || '',
    strategy: row?.strategy || 'extra_review',
    min_confidence: row ? String(row.min_confidence) : '0.8',
    notes: row?.notes || '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!form.label.trim()) return setErr('请填写长尾类别');
    setBusy(true);
    try {
      const body = {
        task_type: form.task_type,
        label: form.label.trim(),
        strategy: form.strategy,
        min_confidence: Number(form.min_confidence),
        notes: form.notes,
      };
      if (row) {
        await fetchData(`/prelabel/long-tail/${row.id}`, { method: 'PATCH', body });
      } else {
        await fetchData('/prelabel/long-tail', { method: 'POST', body });
      }
      toast.success(row ? '长尾策略已保存' : '长尾策略已创建');
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={row ? '编辑长尾策略' : '新增长尾策略'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">任务类型</label>
            <select className="input" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>
              {TASK_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">长尾类别 *</label>
            <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">处理策略</label>
            <select className="input" value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })}>
              {STRATEGIES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">最低置信度 (0~1)</label>
            <input className="input" type="number" step="0.01" min="0" max="1" value={form.min_confidence} onChange={(e) => setForm({ ...form, min_confidence: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">备注</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <ErrBanner msg={err} />
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
