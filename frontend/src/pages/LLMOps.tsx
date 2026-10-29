import { useEffect, useState } from 'react';
import { Plus, X, Play, Flag, Layers } from 'lucide-react';
import { fetchData, fetchList, api } from '../api';
import { useAuth } from '../auth';
import { TaskItem, UnitItem } from '../types';
import { Loading, Empty, Stat, toast } from '../components/common';

type TabKey = 'prompts' | 'costs' | 'hallucinations' | 'consistency' | 'distillations' | 'rounds';

const dt = (s?: string | null) => (s ? s.slice(0, 16).replace('T', ' ') : '—');
const num = (v: number | string | null | undefined) => Number(v ?? 0).toLocaleString();

export default function LLMOps() {
  const { isRole } = useAuth();
  const canManage = isRole('admin', 'operator', 'engineer', 'pm');
  const [tab, setTab] = useState<TabKey>('prompts');

  const tabs: [TabKey, string][] = [
    ['prompts', 'Prompt 管理'],
    ['costs', '成本监控'],
    ['hallucinations', '幻觉检测'],
    ['consistency', '一致性对比'],
    ['distillations', '蒸馏作业'],
    ['rounds', '多轮标注'],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">LLM 运维</h1>
        <p className="text-sm text-slate-500">Prompt 版本、调用成本、幻觉检测、人机一致性、蒸馏作业与多轮标注</p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map(([k, label]) => (
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
      {tab === 'prompts' && <PromptsTab canManage={canManage} />}
      {tab === 'costs' && <CostsTab />}
      {tab === 'hallucinations' && <HallucinationsTab canManage={canManage} />}
      {tab === 'consistency' && <ConsistencyTab canManage={canManage} />}
      {tab === 'distillations' && <DistillationsTab canManage={canManage} />}
      {tab === 'rounds' && <RoundsTab canManage={canManage} />}
    </div>
  );
}

const PROMPT_STATUS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-slate-200 text-slate-500',
};

const TASK_TYPES: [string, string][] = [
  ['classification', '文本分类'],
  ['sentiment', '情感分析'],
  ['entity', '实体抽取'],
  ['object_detection', '目标检测'],
];

// ---------------- Prompt 管理 ----------------
interface PromptRow {
  id: number;
  name: string;
  task_type: string;
  description: string;
  status: string;
  status_label: string;
  current_version: number;
  version_count: number;
  created_at: string;
}

interface PromptVersion {
  id: number;
  template_id: number;
  version: number;
  content: string;
  change_note: string;
  status: string;
  status_label: string;
  created_by: string;
  created_at: string;
}

function PromptsTab({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    fetchList<PromptRow>('/llmops/prompts')
      .then((r) => setItems(r.list))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 新建模板
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="暂无 Prompt 模板" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">名称</th>
                <th className="th">类型</th>
                <th className="th">状态</th>
                <th className="th">当前版本</th>
                <th className="th">版本数</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p) => (
                <tr key={p.id} className="align-top hover:bg-slate-50">
                  <td className="td max-w-xs">
                    <div className="font-medium text-slate-800">{p.name}</div>
                    <div className="truncate text-xs text-slate-400">{p.description || '—'}</div>
                  </td>
                  <td className="td text-xs text-slate-500">{p.task_type || '—'}</td>
                  <td className="td">
                    <span className={`badge ${PROMPT_STATUS[p.status] || 'bg-slate-100 text-slate-600'}`}>{p.status_label}</span>
                  </td>
                  <td className="td tabular-nums">{p.current_version ? `v${p.current_version}` : '—'}</td>
                  <td className="td tabular-nums">{p.version_count}</td>
                  <td className="td text-right">
                    <button className="btn-secondary" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                      {expanded === p.id ? '收起' : '版本'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {err && <div className="text-sm text-rose-600">{err}</div>}
      {expanded !== null && (
        <PromptVersionsPanel templateId={expanded} canManage={canManage} onChanged={load} />
      )}
      {showCreate && <CreatePromptModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function PromptVersionsPanel({
  templateId,
  canManage,
  onChanged,
}: {
  templateId: number;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ content: '', change_note: '' });
  const [publishNo, setPublishNo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setErr('');
    fetchData<{ versions: PromptVersion[]; count: number }>(`/llmops/prompts/${templateId}/versions`)
      .then((r) => setVersions(r.versions || []))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [templateId]);

  const addVersion = async () => {
    setErr('');
    if (!form.content.trim()) return setErr('Prompt 内容不能为空');
    setBusy(true);
    try {
      await fetchData(`/llmops/prompts/${templateId}/versions`, { method: 'POST', body: form });
      toast.success('版本已创建');
      setForm({ content: '', change_note: '' });
      load();
      onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setErr('');
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      if (publishNo) body.version_no = Number(publishNo);
      await fetchData(`/llmops/prompts/${templateId}/publish`, { method: 'POST', body });
      toast.success('版本已发布');
      load();
      onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">版本列表</div>
      {loading ? (
        <Loading />
      ) : versions.length === 0 ? (
        <Empty text="暂无版本" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {versions.map((v) => (
            <li key={v.id} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="badge bg-indigo-50 text-indigo-600">v{v.version}</span>
                <span className={`badge ${PROMPT_STATUS[v.status] || 'bg-slate-100 text-slate-600'}`}>{v.status_label}</span>
                <span className="text-xs text-slate-400">{v.created_by} · {dt(v.created_at)}</span>
              </div>
              {v.change_note && <div className="mt-1 text-xs text-slate-500">{v.change_note}</div>}
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-600">{v.content}</pre>
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <div className="space-y-3 border-t border-slate-100 p-4">
          <div>
            <label className="label">新增版本内容</label>
            <textarea className="input" rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <div><label className="label">变更说明</label><input className="input" value={form.change_note} onChange={(e) => setForm({ ...form, change_note: e.target.value })} /></div>
          <div className="flex flex-wrap items-end gap-3">
            <button className="btn-secondary" onClick={addVersion} disabled={busy}>新建版本</button>
            <div className="w-40">
              <label className="label">发布版本号（默认最新）</label>
              <input className="input" type="number" value={publishNo} onChange={(e) => setPublishNo(e.target.value)} placeholder="留空=最新" />
            </div>
            <button className="btn-primary" onClick={publish} disabled={busy}>发布</button>
          </div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
        </div>
      )}
    </div>
  );
}

function CreatePromptModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', task_type: 'classification', description: '', status: 'draft' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!form.name.trim()) return setErr('请填写模板名称');
    setBusy(true);
    try {
      await fetchData('/llmops/prompts', { method: 'POST', body: form });
      toast.success('模板已创建');
      onCreated();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">新建 Prompt 模板</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="label">名称 *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <label className="label">任务类型</label>
            <select className="input" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>
              {TASK_TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label className="label">描述</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <label className="label">状态</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">草稿</option>
              <option value="active">启用</option>
              <option value="archived">已归档</option>
            </select>
          </div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '提交中…' : '保存'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- 成本监控 ----------------
interface CostRow {
  id: number;
  task_id: number | null;
  unit_id: number | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number | string;
  created_at: string;
}

interface CostSummary {
  total: { calls: number; total_tokens: number; cost: number | string };
  by_model: { model: string; calls: number; prompt_tokens: number; completion_tokens: number; total_tokens: number; cost: number | string }[];
  by_task: { task_id: number | null; calls: number; total_tokens: number; cost: number | string }[];
}

function CostsTab() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [items, setItems] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([
      fetchData<CostSummary>('/llmops/costs/summary'),
      fetchList<CostRow>('/llmops/costs'),
    ])
      .then(([s, l]) => {
        setSummary(s);
        setItems(l.list);
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <Loading />;
  if (err) return <Empty text={err} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="调用次数" value={num(summary?.total.calls)} />
        <Stat label="总 token" value={num(summary?.total.total_tokens)} />
        <Stat label="总成本" value={num(summary?.total.cost)} />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">按模型汇总</div>
        {summary?.by_model?.length ? (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">模型</th>
                <th className="th">调用</th>
                <th className="th">输入 token</th>
                <th className="th">输出 token</th>
                <th className="th">总 token</th>
                <th className="th">成本</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.by_model.map((m) => (
                <tr key={m.model} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-800">{m.model || '—'}</td>
                  <td className="td tabular-nums">{num(m.calls)}</td>
                  <td className="td tabular-nums">{num(m.prompt_tokens)}</td>
                  <td className="td tabular-nums">{num(m.completion_tokens)}</td>
                  <td className="td tabular-nums">{num(m.total_tokens)}</td>
                  <td className="td tabular-nums">{num(m.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty text="暂无成本记录" />
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">调用明细</div>
        {items.length === 0 ? (
          <Empty text="暂无成本记录" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">模型</th>
                <th className="th">任务</th>
                <th className="th">单元</th>
                <th className="th">总 token</th>
                <th className="th">成本</th>
                <th className="th">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="td text-sm text-slate-700">{c.model || '—'}</td>
                  <td className="td tabular-nums text-xs text-slate-500">{c.task_id ? `#${c.task_id}` : '—'}</td>
                  <td className="td tabular-nums text-xs text-slate-500">{c.unit_id ? `#${c.unit_id}` : '—'}</td>
                  <td className="td tabular-nums">{num(c.total_tokens)}</td>
                  <td className="td tabular-nums">{num(c.cost)}</td>
                  <td className="td text-xs text-slate-400">{dt(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------- 幻觉检测 ----------------
interface HallRow {
  id: number;
  unit_id: number;
  model: string;
  is_hallucination: boolean;
  score: number;
  status: string;
  status_label: string;
  created_at: string;
}

interface HallDetail extends HallRow {
  reasons: { rule: string; detail: string }[];
}

function HallucinationsTab({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<HallRow[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [taskId, setTaskId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<HallDetail | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    fetchList<HallRow>('/llmops/hallucinations')
      .then((r) => setItems(r.list))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    api<TaskItem[]>('/tasks').then(setTasks).catch(() => undefined);
  }, []);

  const onTask = (id: string) => {
    setTaskId(id);
    setUnitId('');
    setUnits([]);
    if (id) {
      api<{ items: UnitItem[] }>(`/tasks/${id}/units?page_size=100`)
        .then((r) => setUnits(r.items || []))
        .catch(() => setUnits([]));
    }
  };

  const detect = async () => {
    setErr('');
    if (!unitId) return setErr('请选择数据单元');
    setBusy(true);
    try {
      const check = await fetchData<HallDetail>('/llmops/hallucinations/detect', {
        method: 'POST',
        body: { unit: Number(unitId), model },
      });
      setLast(check);
      toast.success('检测完成');
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="card p-4">
          <div className="mb-3 text-sm font-medium text-slate-700">执行幻觉检测</div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <label className="label">任务</label>
              <select className="input" value={taskId} onChange={(e) => onTask(e.target.value)}>
                <option value="">请选择任务</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="w-72">
              <label className="label">数据单元</label>
              <select className="input" value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={!taskId}>
                <option value="">请选择单元</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>#{u.id} {u.content.slice(0, 30)}</option>
                ))}
              </select>
            </div>
            <div className="w-48">
              <label className="label">模型（可空）</label>
              <input className="input" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={detect} disabled={busy}>{busy ? '检测中…' : '检测'}</button>
          </div>
          {last && (
            <div className={`mt-3 rounded-md p-3 text-sm ${last.is_hallucination ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <div className="font-medium">
                单元 #{last.unit_id} · {last.status_label} · 风险分 {last.score}
              </div>
              {last.reasons?.length ? (
                <ul className="mt-1 list-inside list-disc text-xs">
                  {last.reasons.map((r, i) => <li key={i}>{r.detail}（{r.rule}）</li>)}
                </ul>
              ) : (
                <div className="mt-1 text-xs">未命中异常规则</div>
              )}
            </div>
          )}
          {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="暂无检测记录" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">单元</th>
                <th className="th">模型</th>
                <th className="th">判定</th>
                <th className="th">风险分</th>
                <th className="th">状态</th>
                <th className="th">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="td tabular-nums text-xs text-slate-600">#{h.unit_id}</td>
                  <td className="td text-xs text-slate-500">{h.model || '—'}</td>
                  <td className="td">
                    <span className={`badge ${h.is_hallucination ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {h.is_hallucination ? '疑似幻觉' : '无异常'}
                    </span>
                  </td>
                  <td className="td tabular-nums">{h.score}</td>
                  <td className="td text-xs text-slate-500">{h.status_label}</td>
                  <td className="td text-xs text-slate-400">{dt(h.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------- 一致性对比 ----------------
interface ConsistencyRow {
  id: number;
  task_id: number;
  model: string;
  agreement_rate: number;
  sample_size: number;
  created_at: string;
}

interface ConsistencyDetail extends ConsistencyRow {
  details: { agreed?: number; mismatch_count?: number; mismatches?: { unit_id: number; ai_prediction: any; human_label: any }[] };
}

function ConsistencyTab({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<ConsistencyRow[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [taskId, setTaskId] = useState('');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<ConsistencyDetail | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    fetchList<ConsistencyRow>('/llmops/consistency')
      .then((r) => setItems(r.list))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    api<TaskItem[]>('/tasks').then(setTasks).catch(() => undefined);
  }, []);

  const taskName = (id: number) => tasks.find((t) => t.id === id)?.name || `#${id}`;

  const compare = async () => {
    setErr('');
    if (!taskId) return setErr('请选择任务');
    setBusy(true);
    try {
      const report = await fetchData<ConsistencyDetail>('/llmops/consistency/compare', {
        method: 'POST',
        body: { task: Number(taskId), model },
      });
      setLast(report);
      toast.success('对比完成');
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="card p-4">
          <div className="mb-3 text-sm font-medium text-slate-700">执行一致性对比</div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <label className="label">任务</label>
              <select className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">请选择任务</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="w-48">
              <label className="label">模型（可空）</label>
              <input className="input" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={compare} disabled={busy}>{busy ? '对比中…' : '对比'}</button>
          </div>
          {last && (
            <div className="mt-3 rounded-md bg-indigo-50 p-3 text-sm text-indigo-700">
              <div className="font-medium">
                一致率 {(last.agreement_rate * 100).toFixed(1)}%（样本 {last.sample_size}，一致 {last.details?.agreed ?? 0}，不一致 {last.details?.mismatch_count ?? 0}）
              </div>
              {last.details?.mismatches?.length ? (
                <div className="mt-2 max-h-40 overflow-auto text-xs">
                  {last.details.mismatches.slice(0, 10).map((m) => (
                    <div key={m.unit_id} className="border-t border-indigo-100 py-1">
                      单元 #{m.unit_id} · AI: {JSON.stringify(m.ai_prediction)} · 人工: {JSON.stringify(m.human_label)}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
          {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="暂无一致性报告" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">任务</th>
                <th className="th">模型</th>
                <th className="th">一致率</th>
                <th className="th">样本量</th>
                <th className="th">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="td text-sm text-slate-700">{taskName(c.task_id)}</td>
                  <td className="td text-xs text-slate-500">{c.model || '—'}</td>
                  <td className="td tabular-nums">{(c.agreement_rate * 100).toFixed(1)}%</td>
                  <td className="td tabular-nums">{c.sample_size}</td>
                  <td className="td text-xs text-slate-400">{dt(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------- 蒸馏作业 ----------------
interface DistillRow {
  id: number;
  name: string;
  teacher_model: string;
  student_model: string;
  task_type: string;
  dataset_size: number;
  status: string;
  status_label: string;
  created_at: string;
}

const DISTILL_STATUS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  running: 'bg-blue-100 text-blue-700',
  finished: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
};

function DistillationsTab({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<DistillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [finishing, setFinishing] = useState<DistillRow | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    fetchList<DistillRow>('/llmops/distillations')
      .then((r) => setItems(r.list))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const start = async (id: number) => {
    setErr('');
    try {
      await fetchData(`/llmops/distillations/${id}/start`, { method: 'POST' });
      toast.success('作业已开始');
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 新建作业
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="暂无蒸馏作业" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">名称</th>
                <th className="th">教师 → 学生</th>
                <th className="th">类型</th>
                <th className="th">数据量</th>
                <th className="th">状态</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-800">{d.name}</td>
                  <td className="td text-xs text-slate-500">{d.teacher_model || '—'} → {d.student_model || '—'}</td>
                  <td className="td text-xs text-slate-500">{d.task_type || '—'}</td>
                  <td className="td tabular-nums">{d.dataset_size}</td>
                  <td className="td">
                    <span className={`badge ${DISTILL_STATUS[d.status] || 'bg-slate-100 text-slate-600'}`}>{d.status_label}</span>
                  </td>
                  <td className="td text-right">
                    {canManage && (d.status === 'pending' || d.status === 'failed') && (
                      <button className="btn-secondary" onClick={() => start(d.id)}>
                        <Play className="h-3.5 w-3.5" /> 开始
                      </button>
                    )}
                    {canManage && d.status === 'running' && (
                      <button className="btn-secondary" onClick={() => setFinishing(d)}>
                        <Flag className="h-3.5 w-3.5" /> 结束
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {err && <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-600">{err}</div>}
      </div>

      {showCreate && <CreateDistillModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {finishing && (
        <FinishDistillModal
          job={finishing}
          onClose={() => setFinishing(null)}
          onDone={() => {
            setFinishing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateDistillModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', teacher_model: '', student_model: '', task_type: 'classification', dataset_size: 0, notes: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!form.name.trim()) return setErr('请填写作业名称');
    setBusy(true);
    try {
      await fetchData('/llmops/distillations', { method: 'POST', body: { ...form, dataset_size: Number(form.dataset_size) } });
      toast.success('作业已创建');
      onCreated();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">新建蒸馏作业</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="label">名称 *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">教师模型</label><input className="input" value={form.teacher_model} onChange={(e) => setForm({ ...form, teacher_model: e.target.value })} /></div>
            <div><label className="label">学生模型</label><input className="input" value={form.student_model} onChange={(e) => setForm({ ...form, student_model: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">任务类型</label>
              <select className="input" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>
                {TASK_TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="label">数据集规模</label><input className="input" type="number" value={form.dataset_size} onChange={(e) => setForm({ ...form, dataset_size: Number(e.target.value) })} /></div>
          </div>
          <div><label className="label">备注</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '提交中…' : '保存'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinishDistillModal({ job, onClose, onDone }: { job: DistillRow; onClose: () => void; onDone: () => void }) {
  const [metricsText, setMetricsText] = useState('');
  const [notes, setNotes] = useState('');
  const [failed, setFailed] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    const metrics: Record<string, number> = {};
    metricsText.split(/[,，]/).forEach((kv) => {
      const [k, v] = kv.split(':');
      if (k && v !== undefined && k.trim()) metrics[k.trim()] = Number(v);
    });
    if (Object.keys(metrics).length === 0) return setErr('请填写真实指标（k:v，逗号分隔）');
    setBusy(true);
    try {
      await fetchData(`/llmops/distillations/${job.id}/finish`, { method: 'POST', body: { metrics, notes, failed } });
      toast.success('作业已结束');
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">结束作业 · {job.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="label">真实指标（accuracy:0.9,f1:0.88）*</label><input className="input" value={metricsText} onChange={(e) => setMetricsText(e.target.value)} /></div>
          <div><label className="label">备注</label><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={failed} onChange={(e) => setFailed(e.target.checked)} /> 标记为失败
          </label>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '提交中…' : '结束'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- 多轮标注 ----------------
interface RoundRow {
  id: number;
  task_id: number;
  unit_id: number | null;
  current_round: number;
  max_round: number;
  status: string;
  status_label: string;
  round_count: number;
  created_at: string;
}

interface RoundRecord {
  id: number;
  session_id: number;
  round_no: number;
  label: any;
  annotator: string;
  notes: string;
  created_at: string;
}

interface RoundSessionDetail extends RoundRow {
  rounds: RoundRecord[];
}

const SESSION_META: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  closed: 'bg-slate-200 text-slate-500',
};

function RoundsTab({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<RoundRow[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<RoundSessionDetail | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    fetchList<RoundRow>('/llmops/rounds')
      .then((r) => setItems(r.list))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    api<TaskItem[]>('/tasks').then(setTasks).catch(() => undefined);
  }, []);

  const taskName = (id: number) => tasks.find((t) => t.id === id)?.name || `#${id}`;

  const advance = async (id: number) => {
    setErr('');
    try {
      await fetchData(`/llmops/rounds/${id}/next`, { method: 'POST', body: {} });
      toast.success('已进入下一轮');
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const openDetail = async (id: number) => {
    setErr('');
    try {
      const d = await fetchData<RoundSessionDetail>(`/llmops/rounds/${id}`);
      setDetail(d);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 新建会话
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="暂无多轮会话" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">任务</th>
                <th className="th">单元</th>
                <th className="th">轮次</th>
                <th className="th">记录数</th>
                <th className="th">状态</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="td text-sm text-slate-700">{taskName(s.task_id)}</td>
                  <td className="td tabular-nums text-xs text-slate-500">{s.unit_id ? `#${s.unit_id}` : '—'}</td>
                  <td className="td tabular-nums">{s.current_round} / {s.max_round}</td>
                  <td className="td tabular-nums">{s.round_count}</td>
                  <td className="td">
                    <span className={`badge ${SESSION_META[s.status] || 'bg-slate-100 text-slate-600'}`}>{s.status_label}</span>
                  </td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-2">
                      <button className="btn-secondary" onClick={() => openDetail(s.id)}>查看</button>
                      {canManage && s.status === 'open' && (
                        <button className="btn-secondary" onClick={() => advance(s.id)}>
                          <Layers className="h-3.5 w-3.5" /> 下一轮
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {err && <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-600">{err}</div>}
      </div>

      {detail && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
            会话 #{detail.id} 轮次记录
            <button className="text-slate-400 hover:text-slate-600" onClick={() => setDetail(null)}><X className="h-4 w-4" /></button>
          </div>
          {detail.rounds?.length ? (
            <ul className="divide-y divide-slate-100">
              {detail.rounds.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="badge bg-indigo-50 text-indigo-600">第 {r.round_no} 轮</span>
                    <span>{r.annotator || '—'}</span>
                    <span className="text-slate-300">{dt(r.created_at)}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-700">{JSON.stringify(r.label)}</div>
                  {r.notes && <div className="text-xs text-slate-400">{r.notes}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="暂无轮次记录" />
          )}
        </div>
      )}

      {showCreate && <CreateRoundModal tasks={tasks} onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function CreateRoundModal({ tasks, onClose, onCreated }: { tasks: TaskItem[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ task: '', unit: '', current_round: 1, max_round: 3, status: 'open' });
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const onTask = (id: string) => {
    setForm((f) => ({ ...f, task: id, unit: '' }));
    setUnits([]);
    if (id) {
      api<{ items: UnitItem[] }>(`/tasks/${id}/units?page_size=100`)
        .then((r) => setUnits(r.items || []))
        .catch(() => setUnits([]));
    }
  };

  const submit = async () => {
    setErr('');
    if (!form.task) return setErr('请选择任务');
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        task: Number(form.task),
        current_round: Number(form.current_round),
        max_round: Number(form.max_round),
        status: form.status,
      };
      if (form.unit) body.unit = Number(form.unit);
      await fetchData('/llmops/rounds', { method: 'POST', body });
      toast.success('会话已创建');
      onCreated();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">新建多轮标注会话</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">任务 *</label>
            <select className="input" value={form.task} onChange={(e) => onTask(e.target.value)}>
              <option value="">请选择任务</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">数据单元（可空）</label>
            <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} disabled={!form.task}>
              <option value="">不指定</option>
              {units.map((u) => <option key={u.id} value={u.id}>#{u.id} {u.content.slice(0, 30)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">当前轮次</label><input className="input" type="number" min="1" value={form.current_round} onChange={(e) => setForm({ ...form, current_round: Number(e.target.value) })} /></div>
            <div><label className="label">最大轮次</label><input className="input" type="number" min="1" value={form.max_round} onChange={(e) => setForm({ ...form, max_round: Number(e.target.value) })} /></div>
          </div>
          <div>
            <label className="label">状态</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="open">进行中</option>
              <option value="closed">已关闭</option>
            </select>
          </div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '提交中…' : '保存'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
