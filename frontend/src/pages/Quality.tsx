import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Plus,
  X,
  Trash2,
  Pencil,
  RefreshCw,
  Check,
  ShieldAlert,
  TrendingUp,
  RotateCcw,
  Gavel,
  Users,
} from 'lucide-react';
import { fetchData, fetchList, api } from '../api';
import { useAuth } from '../auth';
import { Loading, Empty, TaskTypeTag } from '../components/common';

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

interface UserOption {
  id: number;
  username: string;
  display_name: string;
  role: string;
}

type TabKey = 'gold' | 'cheat' | 'cross' | 'profiles' | 'trends' | 'rework';

const TABS: [TabKey, string][] = [
  ['gold', '金标埋点'],
  ['cheat', '作弊检测'],
  ['cross', '交叉复核'],
  ['profiles', '能力画像'],
  ['trends', '质量趋势'],
  ['rework', '返工 / 申诉'],
];

export default function Quality() {
  const { isRole } = useAuth();
  const [tab, setTab] = useState<TabKey>('gold');
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    api<TaskOption[]>('/tasks').then(setTasks).catch(() => setTasks([]));
    api<UserOption[]>('/users').then(setUsers).catch(() => setUsers([]));
  }, []);

  const canManage = isRole('admin', 'operator', 'pm');
  const canDetect = isRole('admin', 'operator', 'engineer', 'pm');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">质量管控</h1>
        <p className="text-sm text-slate-500">
          金标埋点、作弊检测、交叉复核、标注员能力画像、质量趋势监控与返工/申诉闭环
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

      {tab === 'gold' && <GoldTab tasks={tasks} users={users} canManage={canManage} />}
      {tab === 'cheat' && <CheatTab tasks={tasks} canDetect={canDetect} />}
      {tab === 'cross' && <CrossTab tasks={tasks} users={users} canManage={canManage} />}
      {tab === 'profiles' && <ProfilesTab users={users} canDetect={canDetect} />}
      {tab === 'trends' && <TrendsTab tasks={tasks} users={users} canDetect={canDetect} />}
      {tab === 'rework' && <ReworkTab canManage={canManage} />}
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
  return <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600">{msg}</div>;
}

function OkBanner({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>;
}

function taskName(tasks: TaskOption[], id: number | null): string {
  if (!id) return '—';
  return tasks.find((t) => t.id === id)?.name || `#${id}`;
}

function labelText(v: any): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v.label) return String(v.label);
  return JSON.stringify(v);
}

/* ---------------- F11.1 金标埋点 ---------------- */

interface GoldSampleRow {
  id: number;
  task_id: number;
  task_name: string;
  content: string;
  active: boolean;
  created_by: string;
  created_at: string;
}

interface GoldSampleDetail extends GoldSampleRow {
  expected_label: any;
}

interface GoldInjectionRow {
  id: number;
  task_id: number;
  sample_id: number;
  unit_id: number | null;
  batch: string;
  assigned_to: string;
  injected_at: string | null;
  created_at: string;
}

function GoldTab({
  tasks,
  users,
  canManage,
}: {
  tasks: TaskOption[];
  users: UserOption[];
  canManage: boolean;
}) {
  const [samples, setSamples] = useState<GoldSampleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<GoldSampleDetail | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [injectTask, setInjectTask] = useState('');
  const [sampleIds, setSampleIds] = useState('');
  const [batch, setBatch] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [injecting, setInjecting] = useState(false);
  const [injectErr, setInjectErr] = useState('');
  const [injectMsg, setInjectMsg] = useState('');

  const [injections, setInjections] = useState<GoldInjectionRow[]>([]);
  const [injLoading, setInjLoading] = useState(true);

  const loadSamples = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<GoldSampleRow>('/qc/gold-samples?pageSize=100')
      .then((r) => setSamples(r.list))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadInjections = useCallback(() => {
    setInjLoading(true);
    fetchList<GoldInjectionRow>('/qc/gold-injections?pageSize=50')
      .then((r) => setInjections(r.list))
      .catch(() => setInjections([]))
      .finally(() => setInjLoading(false));
  }, []);

  useEffect(() => {
    loadSamples();
    loadInjections();
  }, [loadSamples, loadInjections]);

  const editSample = async (row: GoldSampleRow) => {
    setErr('');
    try {
      const d = await fetchData<GoldSampleDetail>(`/qc/gold-samples/${row.id}`);
      setEditing(d);
      setShowForm(true);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const remove = async (row: GoldSampleRow) => {
    if (!window.confirm('确认删除该金标样本？')) return;
    setErr('');
    try {
      await fetchData(`/qc/gold-samples/${row.id}`, { method: 'DELETE' });
      loadSamples();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const inject = async () => {
    setInjecting(true);
    setInjectErr('');
    setInjectMsg('');
    try {
      const ids = sampleIds
        .split(/[,，\s]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      const r = await fetchData<{ injected: number }>('/qc/gold/inject', {
        method: 'POST',
        body: {
          task: Number(injectTask),
          sample_ids: ids,
          batch,
          assigned_to: assignedTo ? Number(assignedTo) : null,
        },
      });
      setInjectMsg(`已注入 ${r.injected} 条金标样本到任务「${taskName(tasks, Number(injectTask))}」队列`);
      loadInjections();
    } catch (e: any) {
      setInjectErr(e.message);
    } finally {
      setInjecting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Users className="h-4 w-4 text-indigo-500" /> 金标注入
          <span className="text-xs font-normal text-slate-400">将金标样本混入任务队列，用于质检与准确率校准</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">标注任务 *</label>
            <select className="input w-56" value={injectTask} onChange={(e) => setInjectTask(e.target.value)}>
              <option value="">请选择任务</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">样本 ID 列表 *（逗号分隔）</label>
            <input className="input w-52" value={sampleIds} onChange={(e) => setSampleIds(e.target.value)} placeholder="如 1,2,3" />
          </div>
          <div>
            <label className="label">批次</label>
            <input className="input w-32" value={batch} onChange={(e) => setBatch(e.target.value)} />
          </div>
          <div>
            <label className="label">指派给</label>
            <select className="input w-40" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">不指派</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={inject} disabled={!canManage || injecting || !injectTask || !sampleIds.trim()}>
            {injecting ? '注入中…' : '注入队列'}
          </button>
        </div>
        {!canManage && <p className="mt-2 text-xs text-slate-400">当前角色无注入权限（需运营/项目经理及以上）</p>}
        <div className="mt-3 space-y-2">
          <ErrBanner msg={injectErr} />
          <OkBanner msg={injectMsg} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">金标样本库</h3>
          {canManage && (
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" /> 新增金标样本
            </button>
          )}
        </div>
        <ErrBanner msg={err} />
        <div className="card overflow-hidden">
          {loading ? (
            <Loading />
          ) : samples.length === 0 ? (
            <Empty text="暂无金标样本" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">ID</th>
                  <th className="th">任务</th>
                  <th className="th">样本内容</th>
                  <th className="th">状态</th>
                  {canManage && <th className="th text-right">操作</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {samples.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="td tabular-nums text-slate-400">#{s.id}</td>
                    <td className="td max-w-[10rem] truncate text-sm text-slate-600">{s.task_name}</td>
                    <td className="td max-w-md truncate">{s.content}</td>
                    <td className="td">
                      {s.active ? (
                        <span className="badge bg-emerald-100 text-emerald-700">启用</span>
                      ) : (
                        <span className="badge bg-slate-200 text-slate-500">停用</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="td text-right">
                        <button className="mr-2 text-slate-400 hover:text-indigo-600" onClick={() => editSample(s)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="text-slate-400 hover:text-rose-600" onClick={() => remove(s)}>
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

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-700">注入记录</h3>
        <div className="card overflow-hidden">
          {injLoading ? (
            <Loading />
          ) : injections.length === 0 ? (
            <Empty text="暂无注入记录" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">任务</th>
                  <th className="th">样本</th>
                  <th className="th">生成单元</th>
                  <th className="th">批次</th>
                  <th className="th">指派给</th>
                  <th className="th">注入时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {injections.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50">
                    <td className="td text-sm text-slate-600">{taskName(tasks, j.task_id)}</td>
                    <td className="td tabular-nums">#{j.sample_id}</td>
                    <td className="td tabular-nums">#{j.unit_id ?? '—'}</td>
                    <td className="td text-xs text-slate-500">{j.batch || '—'}</td>
                    <td className="td text-sm text-slate-600">{j.assigned_to || '—'}</td>
                    <td className="td whitespace-nowrap text-xs text-slate-400">
                      {(j.injected_at || j.created_at || '').slice(0, 16).replace('T', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <GoldSampleForm
          row={editing}
          tasks={tasks}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            loadSamples();
          }}
        />
      )}
    </div>
  );
}

function GoldSampleForm({
  row,
  tasks,
  onClose,
  onSaved,
}: {
  row: GoldSampleDetail | null;
  tasks: TaskOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    task: row ? String(row.task_id) : '',
    content: row?.content || '',
    expected_label: row ? labelText(row.expected_label) : '',
    active: row?.active ?? true,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!form.task) return setErr('请选择任务');
    if (!form.content.trim()) return setErr('金标样本内容不能为空');
    setBusy(true);
    try {
      const body = {
        task: Number(form.task),
        content: form.content,
        expected_label: form.expected_label.trim() ? { label: form.expected_label.trim() } : {},
        active: form.active,
      };
      if (row) {
        await fetchData(`/qc/gold-samples/${row.id}`, { method: 'PATCH', body });
      } else {
        await fetchData('/qc/gold-samples', { method: 'POST', body });
      }
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={row ? '编辑金标样本' : '新增金标样本'} onClose={onClose}>
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
          <label className="label">样本内容 *</label>
          <textarea className="input" rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        </div>
        <div>
          <label className="label">期望标签</label>
          <input className="input" value={form.expected_label} onChange={(e) => setForm({ ...form, expected_label: e.target.value })} placeholder="如 正向" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          启用（可被注入）
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

/* ---------------- F11.2 作弊检测 ---------------- */

interface CheatRow {
  id: number;
  task_id: number;
  annotator: string;
  pattern_type: string;
  pattern_type_label: string;
  score: number;
  status: string;
  status_label: string;
  created_at: string;
}

interface CheatDetail extends CheatRow {
  evidence: any;
}

const CHEAT_STATUS_CLS: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-rose-100 text-rose-700',
  dismissed: 'bg-slate-100 text-slate-500',
};

function CheatTab({ tasks, canDetect }: { tasks: TaskOption[]; canDetect: boolean }) {
  const [task, setTask] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<CheatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [detail, setDetail] = useState<CheatDetail | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const params = new URLSearchParams({ pageSize: '100' });
    if (task) params.set('task', task);
    if (status) params.set('status', status);
    fetchList<CheatRow>(`/qc/cheat-detections?${params.toString()}`)
      .then((r) => setRows(r.list))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [task, status]);
  useEffect(load, [load]);

  const detect = async () => {
    setRunning(true);
    setErr('');
    setMsg('');
    try {
      const r = await fetchData<{ detections: CheatRow[] }>('/qc/cheat/detect', { method: 'POST', body: { task: Number(task) } });
      setMsg(`检测完成，新增 / 刷新 ${r.detections.length} 条可疑记录`);
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setRunning(false);
    }
  };

  const openDetail = async (row: CheatRow) => {
    setErr('');
    try {
      setDetail(await fetchData<CheatDetail>(`/qc/cheat-detections/${row.id}`));
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <ShieldAlert className="h-4 w-4 text-rose-500" /> 作弊检测
          <span className="text-xs font-normal text-slate-400">识别连续同标签、审核过快、照抄 AI 等异常模式</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">标注任务 *</label>
            <select className="input w-64" value={task} onChange={(e) => setTask(e.target.value)}>
              <option value="">请选择任务</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={detect} disabled={!canDetect || running || !task}>
            <RefreshCw className="h-4 w-4" /> {running ? '检测中…' : '运行检测'}
          </button>
        </div>
        {!canDetect && <p className="mt-2 text-xs text-slate-400">当前角色无检测权限（需运营/算法工程师/项目经理及以上）</p>}
        <div className="mt-3 space-y-2">
          <ErrBanner msg={err} />
          <OkBanner msg={msg} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="label mb-0">状态过滤</label>
          <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部</option>
            <option value="open">待处理</option>
            <option value="confirmed">已确认</option>
            <option value="dismissed">已排除</option>
          </select>
        </div>
        <div className="card overflow-hidden">
          {loading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty text="暂无作弊检测记录" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">标注员</th>
                  <th className="th">任务</th>
                  <th className="th">异常模式</th>
                  <th className="th">可疑分</th>
                  <th className="th">状态</th>
                  <th className="th">时间</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-700">{r.annotator || '—'}</td>
                    <td className="td text-sm text-slate-500">{taskName(tasks, r.task_id)}</td>
                    <td className="td"><span className="badge bg-rose-50 text-rose-600">{r.pattern_type_label}</span></td>
                    <td className="td tabular-nums">{(r.score * 100).toFixed(1)}%</td>
                    <td className="td"><span className={`badge ${CHEAT_STATUS_CLS[r.status] || 'bg-slate-100 text-slate-500'}`}>{r.status_label}</span></td>
                    <td className="td whitespace-nowrap text-xs text-slate-400">{r.created_at.slice(0, 16).replace('T', ' ')}</td>
                    <td className="td text-right">
                      <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => openDetail(r)}>
                        证据
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
        <Modal title={`作弊检测证据 #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div>标注员：{detail.annotator || '—'}</div>
              <div>异常模式：{detail.pattern_type_label}</div>
              <div>可疑分：{(detail.score * 100).toFixed(1)}%</div>
              <div>状态：{detail.status_label}</div>
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-400">证据：</div>
              <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-600">{JSON.stringify(detail.evidence, null, 2)}</pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- F11.3 交叉复核 ---------------- */

interface CrossRow {
  id: number;
  unit_id: number;
  reviewer_a: string;
  reviewer_b: string;
  agreed: boolean;
  status: string;
  status_label: string;
  created_at: string;
}

interface CrossDetail extends CrossRow {
  label_a: any;
  label_b: any;
}

const CROSS_STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  agreed: 'bg-emerald-100 text-emerald-700',
  disagreed: 'bg-rose-100 text-rose-700',
  resolved: 'bg-blue-100 text-blue-700',
};

function CrossTab({
  tasks,
  users,
  canManage,
}: {
  tasks: TaskOption[];
  users: UserOption[];
  canManage: boolean;
}) {
  const [rows, setRows] = useState<CrossRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [detail, setDetail] = useState<CrossDetail | null>(null);

  const [reviewerA, setReviewerA] = useState('');
  const [reviewerB, setReviewerB] = useState('');
  const [unitIds, setUnitIds] = useState('');
  const [task, setTask] = useState('');
  const [count, setCount] = useState('20');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState('');
  const [assignErr, setAssignErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<CrossRow>('/qc/cross-reviews?pageSize=100')
      .then((r) => setRows(r.list))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const assign = async () => {
    setAssigning(true);
    setAssignErr('');
    setAssignMsg('');
    try {
      const ids = unitIds
        .split(/[,，\s]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      const body: Record<string, any> = {
        reviewer_a: Number(reviewerA),
        reviewer_b: Number(reviewerB),
      };
      if (ids.length) body.unit_ids = ids;
      else body.count = Number(count) || 20;
      if (task) body.task = Number(task);
      const r = await fetchData<{ count: number }>('/qc/cross-review', { method: 'POST', body });
      setAssignMsg(`已创建 ${r.count} 条交叉复核记录`);
      load();
    } catch (e: any) {
      setAssignErr(e.message);
    } finally {
      setAssigning(false);
    }
  };

  const openDetail = async (row: CrossRow) => {
    setErr('');
    try {
      setDetail(await fetchData<CrossDetail>(`/qc/cross-reviews/${row.id}`));
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Users className="h-4 w-4 text-cyan-500" /> 指派交叉复核
          <span className="text-xs font-normal text-slate-400">两位复核人对同一批单元独立标注；未填单元则按任务取前 N 条</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div>
            <label className="label">复核人 A *</label>
            <select className="input" value={reviewerA} onChange={(e) => setReviewerA(e.target.value)}>
              <option value="">请选择</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">复核人 B *</label>
            <select className="input" value={reviewerB} onChange={(e) => setReviewerB(e.target.value)}>
              <option value="">请选择</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">单元 ID 列表（可选，逗号分隔）</label>
            <input className="input" value={unitIds} onChange={(e) => setUnitIds(e.target.value)} placeholder="如 1,2,3" />
          </div>
          <div>
            <label className="label">任务（未指定单元时）</label>
            <select className="input" value={task} onChange={(e) => setTask(e.target.value)}>
              <option value="">请选择任务</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">取样条数</label>
            <input className="input" type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={assign} disabled={!canManage || assigning || !reviewerA || !reviewerB}>
              {assigning ? '指派中…' : '创建复核'}
            </button>
          </div>
        </div>
        {!canManage && <p className="mt-2 text-xs text-slate-400">当前角色无指派权限（需运营/项目经理及以上）</p>}
        <div className="mt-3 space-y-2">
          <ErrBanner msg={assignErr} />
          <OkBanner msg={assignMsg} />
        </div>
      </div>

      <div className="space-y-2">
        <ErrBanner msg={err} />
        <div className="card overflow-hidden">
          {loading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty text="暂无交叉复核记录" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">单元</th>
                  <th className="th">复核人 A</th>
                  <th className="th">复核人 B</th>
                  <th className="th">是否一致</th>
                  <th className="th">状态</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td tabular-nums">#{r.unit_id}</td>
                    <td className="td text-sm text-slate-600">{r.reviewer_a || '—'}</td>
                    <td className="td text-sm text-slate-600">{r.reviewer_b || '—'}</td>
                    <td className="td">
                      {r.agreed ? (
                        <span className="badge bg-emerald-100 text-emerald-700">一致</span>
                      ) : (
                        <span className="badge bg-rose-100 text-rose-700">不一致</span>
                      )}
                    </td>
                    <td className="td"><span className={`badge ${CROSS_STATUS_CLS[r.status] || 'bg-slate-100 text-slate-500'}`}>{r.status_label}</span></td>
                    <td className="td text-right">
                      <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => openDetail(r)}>
                        结果
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
        <Modal title={`交叉复核 #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div>单元：#{detail.unit_id}</div>
              <div>状态：{detail.status_label}</div>
              <div>复核人 A：{detail.reviewer_a || '—'}</div>
              <div>复核人 B：{detail.reviewer_b || '—'}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-slate-50 p-2">
                <div className="mb-1 text-slate-400">A 结果</div>
                <code className="break-all text-slate-600">{JSON.stringify(detail.label_a)}</code>
              </div>
              <div className="rounded bg-slate-50 p-2">
                <div className="mb-1 text-slate-400">B 结果</div>
                <code className="break-all text-slate-600">{JSON.stringify(detail.label_b)}</code>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- F11.4 能力画像 ---------------- */

interface ProfileRow {
  id: number;
  annotator: string;
  task_type: string;
  accuracy: number;
  total_reviewed: number;
  created_at: string;
  updated_at: string;
}

interface ProfileDetail extends ProfileRow {
  category_metrics: Record<string, { count?: number; share?: number }>;
}

function ProfilesTab({ users, canDetect }: { users: UserOption[]; canDetect: boolean }) {
  const [taskType, setTaskType] = useState('');
  const [annotator, setAnnotator] = useState('');
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [detail, setDetail] = useState<ProfileDetail | null>(null);

  const [rebuildType, setRebuildType] = useState('');
  const [rebuildAnnotator, setRebuildAnnotator] = useState('');
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildErr, setRebuildErr] = useState('');
  const [rebuildMsg, setRebuildMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const params = new URLSearchParams({ pageSize: '100' });
    if (taskType) params.set('task_type', taskType);
    if (annotator) params.set('annotator', annotator);
    fetchList<ProfileRow>(`/qc/profiles?${params.toString()}`)
      .then((r) => setRows(r.list))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [taskType, annotator]);
  useEffect(load, [load]);

  const rebuild = async () => {
    setRebuilding(true);
    setRebuildErr('');
    setRebuildMsg('');
    try {
      const body: Record<string, any> = {};
      if (rebuildType) body.task_type = rebuildType;
      if (rebuildAnnotator) body.annotator = Number(rebuildAnnotator);
      const r = await fetchData<{ count: number }>('/qc/profiles/rebuild', { method: 'POST', body });
      setRebuildMsg(`画像重建完成，共 ${r.count} 条`);
      load();
    } catch (e: any) {
      setRebuildErr(e.message);
    } finally {
      setRebuilding(false);
    }
  };

  const openDetail = async (row: ProfileRow) => {
    setErr('');
    try {
      setDetail(await fetchData<ProfileDetail>(`/qc/profiles/${row.id}`));
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <RotateCcw className="h-4 w-4 text-indigo-500" /> 能力画像重建
          <span className="text-xs font-normal text-slate-400">依据已复核样本的人工结果重建标注员能力画像</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">任务类型（可选）</label>
            <select className="input w-40" value={rebuildType} onChange={(e) => setRebuildType(e.target.value)}>
              <option value="">全部</option>
              {TASK_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">标注员（可选）</label>
            <select className="input w-44" value={rebuildAnnotator} onChange={(e) => setRebuildAnnotator(e.target.value)}>
              <option value="">全部</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={rebuild} disabled={!canDetect || rebuilding}>
            <RefreshCw className="h-4 w-4" /> {rebuilding ? '重建中…' : '重建画像'}
          </button>
        </div>
        {!canDetect && <p className="mt-2 text-xs text-slate-400">当前角色无重建权限（需运营/算法工程师/项目经理及以上）</p>}
        <div className="mt-3 space-y-2">
          <ErrBanner msg={rebuildErr} />
          <OkBanner msg={rebuildMsg} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">任务类型过滤</label>
            <select className="input w-40" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
              <option value="">全部</option>
              {TASK_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">标注员过滤</label>
            <select className="input w-44" value={annotator} onChange={(e) => setAnnotator(e.target.value)}>
              <option value="">全部</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
              ))}
            </select>
          </div>
        </div>
        <ErrBanner msg={err} />
        <div className="card overflow-hidden">
          {loading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty text="暂无能力画像，可执行重建" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">标注员</th>
                  <th className="th">任务类型</th>
                  <th className="th">准确率</th>
                  <th className="th">累计审核量</th>
                  <th className="th">更新时间</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-700">{r.annotator || '—'}</td>
                    <td className="td"><TaskTypeTag type={r.task_type} /></td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full bg-indigo-500" style={{ width: `${Math.round(r.accuracy * 100)}%` }} />
                        </div>
                        <span className="tabular-nums text-xs font-medium text-slate-600">{(r.accuracy * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="td tabular-nums">{r.total_reviewed}</td>
                    <td className="td whitespace-nowrap text-xs text-slate-400">{r.updated_at.slice(0, 16).replace('T', ' ')}</td>
                    <td className="td text-right">
                      <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => openDetail(r)}>
                        类别指标
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
        <Modal title={`能力画像：${detail.annotator || '—'}`} onClose={() => setDetail(null)}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
              <div>任务类型：{detail.task_type}</div>
              <div>准确率：{(detail.accuracy * 100).toFixed(1)}%</div>
              <div>累计审核：{detail.total_reviewed}</div>
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-400">类别指标：</div>
              {Object.keys(detail.category_metrics || {}).length === 0 ? (
                <span className="text-xs text-slate-400">无</span>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(detail.category_metrics).map(([label, m]) => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <span className="w-24 truncate text-slate-600">{label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-cyan-500" style={{ width: `${Math.round((m.share || 0) * 100)}%` }} />
                      </div>
                      <span className="tabular-nums text-slate-500">{m.count ?? 0} 条</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- F11.5 质量趋势 ---------------- */

interface TrendPoint {
  date: string;
  annotator_id: number | null;
  task_id: number | null;
  accuracy: number | null;
  sample_size: number;
}

interface QualityTrendRow {
  id: number;
  annotator: string;
  task_id: number | null;
  date: string;
  accuracy: number;
  sample_size: number;
  created_at: string;
}

function TrendsTab({
  tasks,
  users,
  canDetect,
}: {
  tasks: TaskOption[];
  users: UserOption[];
  canDetect: boolean;
}) {
  const [taskType, setTaskType] = useState('');
  const [annotator, setAnnotator] = useState('');
  const [task, setTask] = useState('');
  const [persist, setPersist] = useState(false);

  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [running, setRunning] = useState(false);

  const [snapshots, setSnapshots] = useState<QualityTrendRow[]>([]);
  const [snapLoading, setSnapLoading] = useState(true);

  const loadSnapshots = useCallback(() => {
    setSnapLoading(true);
    fetchList<QualityTrendRow>('/qc/quality-trends?pageSize=50')
      .then((r) => setSnapshots(r.list))
      .catch(() => setSnapshots([]))
      .finally(() => setSnapLoading(false));
  }, []);

  const loadTrends = useCallback(() => {
    setLoading(true);
    setErr('');
    setMsg('');
    const params = new URLSearchParams();
    if (taskType) params.set('task_type', taskType);
    if (annotator) params.set('annotator', annotator);
    if (task) params.set('task', task);
    if (persist) params.set('persist', 'true');
    fetchData<{ trends: TrendPoint[]; count: number }>(`/qc/trends?${params.toString()}`)
      .then((r) => {
        setTrends(r.trends);
        if (persist) {
          setMsg(`已按天计算并落库 ${r.count} 条趋势快照`);
          loadSnapshots();
        }
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [taskType, annotator, task, persist, loadSnapshots]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const load = async () => {
    setRunning(true);
    await loadTrends();
    setRunning(false);
  };

  const bars = trends
    .filter((t) => t.accuracy != null)
    .map((t) => ({ ...t, accuracy: t.accuracy as number }));

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <TrendingUp className="h-4 w-4 text-emerald-500" /> 质量趋势（按天计算）
          <span className="text-xs font-normal text-slate-400">准确率以「人工结果与 AI 一致」作为代理指标</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">任务类型</label>
            <select className="input w-40" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
              <option value="">全部</option>
              {TASK_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">标注员</label>
            <select className="input w-40" value={annotator} onChange={(e) => setAnnotator(e.target.value)}>
              <option value="">全部</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">任务</label>
            <select className="input w-48" value={task} onChange={(e) => setTask(e.target.value)}>
              <option value="">全部</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} disabled={!canDetect} />
            落库快照
          </label>
          <button className="btn-primary" onClick={load} disabled={running}>
            <RefreshCw className="h-4 w-4" /> {running ? '计算中…' : '计算趋势'}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          <ErrBanner msg={err} />
          <OkBanner msg={msg} />
        </div>
        {loading ? (
          <Loading />
        ) : bars.length === 0 ? (
          <Empty text="暂无可计算的趋势数据" />
        ) : (
          <div className="mt-3 space-y-1.5">
            {bars.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-24 whitespace-nowrap text-slate-500">{t.date}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.round(t.accuracy * 100)}%` }} />
                </div>
                <span className="w-16 text-right tabular-nums text-slate-600">{(t.accuracy * 100).toFixed(1)}%</span>
                <span className="w-20 text-right text-slate-400">样本 {t.sample_size}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-700">趋势快照（已落库）</h3>
        <div className="card overflow-hidden">
          {snapLoading ? (
            <Loading />
          ) : snapshots.length === 0 ? (
            <Empty text="暂无落库的趋势快照，可勾选「落库快照」后计算" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">日期</th>
                  <th className="th">标注员</th>
                  <th className="th">任务</th>
                  <th className="th">准确率</th>
                  <th className="th">样本量</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshots.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="td whitespace-nowrap text-slate-600">{s.date}</td>
                    <td className="td text-sm text-slate-600">{s.annotator || '—'}</td>
                    <td className="td text-sm text-slate-500">{taskName(tasks, s.task_id)}</td>
                    <td className="td tabular-nums">{(s.accuracy * 100).toFixed(1)}%</td>
                    <td className="td tabular-nums">{s.sample_size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- F11.6 返工 / 申诉 ---------------- */

interface ReworkRow {
  id: number;
  task_id: number;
  unit_id: number | null;
  reason: string;
  status: string;
  status_label: string;
  assigned_to: string;
  source: string;
  created_at: string;
}

interface AppealRow {
  id: number;
  annotator: string;
  unit_id: number | null;
  reason: string;
  status: string;
  status_label: string;
  created_at: string;
}

const REWORK_STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  reworked: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-200 text-slate-500',
};

const APPEAL_STATUS_CLS: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

function ReworkTab({ canManage }: { canManage: boolean }) {
  const [reworks, setReworks] = useState<ReworkRow[]>([]);
  const [rwLoading, setRwLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [apLoading, setApLoading] = useState(true);
  const [handling, setHandling] = useState<AppealRow | null>(null);

  const loadReworks = useCallback(() => {
    setRwLoading(true);
    fetchList<ReworkRow>('/qc/reworks?pageSize=50')
      .then((r) => setReworks(r.list))
      .catch((e) => setErr(e.message))
      .finally(() => setRwLoading(false));
  }, []);

  const loadAppeals = useCallback(() => {
    setApLoading(true);
    fetchList<AppealRow>('/qc/appeals?pageSize=50')
      .then((r) => setAppeals(r.list))
      .catch((e) => setErr(e.message))
      .finally(() => setApLoading(false));
  }, []);

  useEffect(() => {
    loadReworks();
    loadAppeals();
  }, [loadReworks, loadAppeals]);

  const complete = async (row: ReworkRow) => {
    setErr('');
    setMsg('');
    try {
      await fetchData(`/qc/reworks/${row.id}/complete`, { method: 'POST' });
      setMsg(`返工任务 #${row.id} 已完成，关联单元已退回待审核`);
      loadReworks();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-700">返工任务</h3>
        <ErrBanner msg={err} />
        <OkBanner msg={msg} />
        <div className="card overflow-hidden">
          {rwLoading ? (
            <Loading />
          ) : reworks.length === 0 ? (
            <Empty text="暂无返工任务" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">ID</th>
                  <th className="th">单元</th>
                  <th className="th">原因</th>
                  <th className="th">来源</th>
                  <th className="th">指派给</th>
                  <th className="th">状态</th>
                  {canManage && <th className="th text-right">操作</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reworks.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td tabular-nums text-slate-400">#{r.id}</td>
                    <td className="td tabular-nums">#{r.unit_id ?? '—'}</td>
                    <td className="td max-w-xs truncate text-sm text-slate-600">{r.reason || '—'}</td>
                    <td className="td text-xs text-slate-500">{r.source || '—'}</td>
                    <td className="td text-sm text-slate-600">{r.assigned_to || '—'}</td>
                    <td className="td"><span className={`badge ${REWORK_STATUS_CLS[r.status] || 'bg-slate-100 text-slate-500'}`}>{r.status_label}</span></td>
                    {canManage && (
                      <td className="td text-right">
                        {r.status === 'pending' ? (
                          <button className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline" onClick={() => complete(r)}>
                            <Check className="h-3.5 w-3.5" /> 完成返工
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-700">申诉通道</h3>
        <div className="card overflow-hidden">
          {apLoading ? (
            <Loading />
          ) : appeals.length === 0 ? (
            <Empty text="暂无申诉" />
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">标注员</th>
                  <th className="th">单元</th>
                  <th className="th">申诉理由</th>
                  <th className="th">状态</th>
                  <th className="th">时间</th>
                  {canManage && <th className="th text-right">操作</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appeals.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-700">{a.annotator || '—'}</td>
                    <td className="td tabular-nums">#{a.unit_id ?? '—'}</td>
                    <td className="td max-w-xs truncate text-sm text-slate-600">{a.reason || '—'}</td>
                    <td className="td"><span className={`badge ${APPEAL_STATUS_CLS[a.status] || 'bg-slate-100 text-slate-500'}`}>{a.status_label}</span></td>
                    <td className="td whitespace-nowrap text-xs text-slate-400">{a.created_at.slice(0, 16).replace('T', ' ')}</td>
                    {canManage && (
                      <td className="td text-right">
                        {a.status === 'open' ? (
                          <button className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline" onClick={() => setHandling(a)}>
                            <Gavel className="h-3.5 w-3.5" /> 处理
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">已处理</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {handling && (
        <AppealHandleModal
          appeal={handling}
          onClose={() => setHandling(null)}
          onHandled={(m) => {
            setMsg(m);
            setHandling(null);
            loadAppeals();
          }}
          onError={(m) => setErr(m)}
        />
      )}
    </div>
  );
}

function AppealHandleModal({
  appeal,
  onClose,
  onHandled,
  onError,
}: {
  appeal: AppealRow;
  onClose: () => void;
  onHandled: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [status, setStatus] = useState('accepted');
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await fetchData(`/qc/appeals/${appeal.id}/handle`, { method: 'POST', body: { status, resolution } });
      onHandled(`申诉 #${appeal.id} 已${status === 'accepted' ? '受理' : '驳回'}${status === 'accepted' ? '，关联单元已重新复核' : ''}`);
    } catch (e: any) {
      onError(e.message);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`处理申诉 #${appeal.id}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded bg-slate-50 p-2 text-xs text-slate-600">申诉理由：{appeal.reason || '—'}</div>
        <div>
          <label className="label">处理结果</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="accepted">受理（重开单元复核）</option>
            <option value="rejected">驳回</option>
          </select>
        </div>
        <div>
          <label className="label">处理结论</label>
          <textarea className="input" rows={2} value={resolution} onChange={(e) => setResolution(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? '提交中…' : '提交'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
