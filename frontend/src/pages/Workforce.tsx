import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  X,
  Trash2,
  Pencil,
  UserPlus,
  Tags,
  Clock,
  Wallet,
  Calculator,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { api, fetchData, fetchList } from '../api';
import { useAuth } from '../auth';
import { Loading, Empty } from '../components/common';

// ---- 公共常量与工具 ----

const PRIORITIES: [string, string][] = [
  ['urgent', '紧急'],
  ['high', '高'],
  ['normal', '普通'],
  ['low', '低'],
];

const QUEUE_STATUSES: [string, string][] = [
  ['queued', '排队中'],
  ['assigned', '已分配'],
  ['done', '已完成'],
];

const ASSIGN_STATUSES: [string, string][] = [
  ['assigned', '已分配'],
  ['in_progress', '进行中'],
  ['completed', '已完成'],
  ['revoked', '已撤销'],
];

const PAY_MODES: [string, string][] = [
  ['piece', '计件'],
  ['hour', '计时'],
];

const PRIORITY_CLS: Record<string, string> = {
  urgent: 'bg-rose-100 text-rose-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-slate-100 text-slate-600',
  low: 'bg-slate-50 text-slate-400',
};

const QUEUE_STATUS_CLS: Record<string, string> = {
  queued: 'bg-amber-100 text-amber-700',
  assigned: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
};

const ASSIGN_STATUS_CLS: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
  revoked: 'bg-slate-200 text-slate-500',
};

function labelOf(list: [string, string][], key: string): string {
  return list.find(([k]) => k === key)?.[1] || key;
}

function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return String(iso);
  }
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function Pill({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`badge ${cls}`}>{children}</span>;
}

function splitSkills(text: string): string[] {
  return text
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---- 类型 ----

interface QueueEntry {
  id: number;
  task_id: number;
  task_name: string;
  priority: string;
  priority_label: string;
  order: number;
  status: string;
  status_label: string;
  created_by: string;
  created_at: string;
}

interface Assignment {
  id: number;
  task_id: number;
  task_name: string;
  unit_id: number | null;
  assignee: string;
  assigned_by: string;
  status: string;
  status_label: string;
  matched_skills: string[];
  score: number;
  created_at: string;
}

interface AssignResult {
  assigned: number;
  assignments: {
    assignment_id: number;
    assignee: string;
    matched_skills: string[];
    load: number;
    score: number;
  }[];
}

interface Skill {
  id: number;
  name: string;
  category: string;
  task_type: string;
  created_at: string;
  updated_at: string;
}

interface Worklog {
  id: number;
  assignee: string;
  task_id: number | null;
  task_name: string;
  assignment_id: number | null;
  effective_minutes: number;
  work_date: string | null;
  note: string;
  created_at: string;
}

interface PayScheme {
  id: number;
  name: string;
  mode: string;
  mode_label: string;
  rate: string;
  currency: string;
  task_type: string;
  description: string;
  created_at: string;
}

interface Shift {
  id: number;
  name: string;
  assignee: string;
  start_at: string;
  end_at: string;
  capacity: number;
  note: string;
  created_at: string;
}

interface Estimate {
  id: number;
  task_id: number;
  task_name: string;
  estimated_minutes: number;
  method: string;
  sample_size: number;
  basis: any;
  created_by: string;
  created_at: string;
}

interface Vendor {
  id: number;
  name: string;
  vendor: string;
  isolation_key: string;
  is_isolated: boolean;
  contact: string;
  capacity: number;
  created_at: string;
  updated_at: string;
}

interface UserOption {
  id: number;
  username: string;
  display_name: string;
}

// ---- 页面 ----

type Tab = 'queue' | 'assign' | 'skills' | 'worklogs' | 'pay' | 'estimate';

export default function Workforce() {
  const { isRole } = useAuth();
  const [tab, setTab] = useState<Tab>('queue');
  const canManage = isRole('admin', 'operator', 'pm');
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    api<UserOption[]>('/users')
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">任务调度与人力管理</h1>
        <p className="text-sm text-slate-500">任务队列、技能匹配分配、工时薪资与外包管理</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            ['queue', '任务队列'],
            ['assign', '分配'],
            ['skills', '技能标签'],
            ['worklogs', '工时'],
            ['pay', '薪酬与排班'],
            ['estimate', '预估与外包'],
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
      {tab === 'queue' && <QueueTab canManage={canManage} />}
      {tab === 'assign' && <AssignTab canManage={canManage} />}
      {tab === 'skills' && <SkillsTab canManage={canManage} />}
      {tab === 'worklogs' && <WorklogsTab canManage={canManage} users={users} />}
      {tab === 'pay' && <PayTab canManage={canManage} users={users} />}
      {tab === 'estimate' && <EstimateTab canManage={canManage} />}
    </div>
  );
}

// ---- Tab1：任务队列 ----

function QueueTab({ canManage }: { canManage: boolean }) {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fPriority, setFPriority] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ priority: 'normal', order: '0' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<QueueEntry>(`/workforce/queue${qs({ status: fStatus, priority: fPriority, pageSize: 50 })}`)
      .then((r) => {
        setEntries(r.list);
        setTotal(r.total);
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [fStatus, fPriority]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (e: QueueEntry) => {
    setEditId(e.id);
    setEditForm({ priority: e.priority, order: String(e.order) });
  };

  const saveEdit = async () => {
    if (editId === null) return;
    setErr('');
    setBusy(true);
    try {
      await fetchData(`/workforce/queue/${editId}/reprioritize`, {
        method: 'POST',
        body: { priority: editForm.priority, order: Number(editForm.order) || 0 },
      });
      setEditId(null);
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">状态</label>
          <select className="input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">全部</option>
            {QUEUE_STATUSES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">优先级</label>
          <select className="input" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
            <option value="">全部</option>
            {PRIORITIES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary" onClick={load}>
          <RefreshCw className="h-4 w-4" /> 刷新
        </button>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 入队
          </button>
        )}
      </div>

      {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          共 <span className="font-medium tabular-nums">{total}</span> 条队列
        </div>
        {loading ? (
          <Loading />
        ) : entries.length === 0 ? (
          <Empty text="暂无队列条目" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">任务</th>
                <th className="th">优先级</th>
                <th className="th">顺序</th>
                <th className="th">状态</th>
                <th className="th">创建人</th>
                <th className="th">时间</th>
                {canManage && <th className="th">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="td">
                    <div className="font-medium text-slate-800">{e.task_name || `#${e.task_id}`}</div>
                    <div className="text-xs text-slate-400">#{e.task_id}</div>
                  </td>
                  <td className="td">
                    <Pill cls={PRIORITY_CLS[e.priority] || 'bg-slate-100 text-slate-600'}>
                      {e.priority_label || labelOf(PRIORITIES, e.priority)}
                    </Pill>
                  </td>
                  <td className="td tabular-nums">{e.order}</td>
                  <td className="td">
                    <Pill cls={QUEUE_STATUS_CLS[e.status] || 'bg-slate-100 text-slate-600'}>
                      {e.status_label || labelOf(QUEUE_STATUSES, e.status)}
                    </Pill>
                  </td>
                  <td className="td text-slate-500">{e.created_by || '—'}</td>
                  <td className="td whitespace-nowrap text-xs text-slate-400">{formatTime(e.created_at)}</td>
                  {canManage && (
                    <td className="td">
                      {editId === e.id ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            className="input !w-auto"
                            value={editForm.priority}
                            onChange={(ev) => setEditForm({ ...editForm, priority: ev.target.value })}
                          >
                            {PRIORITIES.map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                          <input
                            className="input !w-16"
                            type="number"
                            value={editForm.order}
                            onChange={(ev) => setEditForm({ ...editForm, order: ev.target.value })}
                          />
                          <button className="btn-primary !px-2" onClick={saveEdit} disabled={busy}>
                            保存
                          </button>
                          <button className="btn-secondary !px-2" onClick={() => setEditId(null)}>
                            取消
                          </button>
                        </div>
                      ) : (
                        <button className="btn-secondary !px-2" onClick={() => startEdit(e)}>
                          <Pencil className="h-3.5 w-3.5" /> 调整
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateQueueModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function CreateQueueModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ task: '', priority: 'normal', order: '0', status: 'queued' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!form.task.trim()) return setErr('请填写任务 ID');
    setBusy(true);
    try {
      await fetchData('/workforce/queue', {
        method: 'POST',
        body: {
          task: Number(form.task),
          priority: form.priority,
          order: Number(form.order) || 0,
          status: form.status,
        },
      });
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
          <h2 className="text-lg font-semibold">任务入队</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">任务 ID *</label>
            <input className="input" type="number" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">优先级</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">顺序</label>
              <input className="input" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
            </div>
            <div>
              <label className="label">状态</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {QUEUE_STATUSES.map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button className="btn-primary" onClick={submit} disabled={busy}>
              {busy ? '提交中…' : '入队'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Tab2：分配 ----

function AssignTab({ canManage }: { canManage: boolean }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fTask, setFTask] = useState('');
  const [fStatus, setFStatus] = useState('');

  const [form, setForm] = useState({ task: '', count: '1', skills: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AssignResult | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<Assignment>(`/workforce/assignments${qs({ task: fTask, status: fStatus, pageSize: 50 })}`)
      .then((r) => {
        setAssignments(r.list);
        setTotal(r.total);
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [fTask, fStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async () => {
    setErr('');
    setResult(null);
    if (!form.task.trim()) return setErr('请填写任务 ID');
    setBusy(true);
    try {
      const res = await fetchData<AssignResult>('/workforce/assign', {
        method: 'POST',
        body: {
          task: Number(form.task),
          count: Number(form.count) || 1,
          skills: splitSkills(form.skills),
        },
      });
      setResult(res);
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
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <UserPlus className="h-4 w-4 text-slate-400" /> 按技能 + 负载触发分配
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">任务 ID *</label>
              <input className="input" type="number" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} />
            </div>
            <div>
              <label className="label">分配数量</label>
              <input className="input !w-24" type="number" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} />
            </div>
            <div className="min-w-[14rem] flex-1">
              <label className="label">所需技能（逗号分隔，可留空）</label>
              <input
                className="input"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                placeholder="如：中文分类,情感"
              />
            </div>
            <button className="btn-primary" onClick={assign} disabled={busy}>
              {busy ? '分配中…' : '开始分配'}
            </button>
          </div>
          {result && (
            <div className="mt-3 rounded-md bg-slate-50 p-3">
              <div className="mb-2 text-sm text-slate-700">
                已分配 <span className="font-medium tabular-nums">{result.assigned}</span> 人
              </div>
              {result.assignments.length > 0 && (
                <ul className="space-y-1 text-sm text-slate-600">
                  {result.assignments.map((a) => (
                    <li key={a.assignment_id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{a.assignee}</span>
                      <span className="text-xs text-slate-400">分配 #{a.assignment_id}</span>
                      <span className="text-xs text-slate-400">当前负载 {a.load}</span>
                      <span className="text-xs text-slate-400">得分 {a.score}</span>
                      {a.matched_skills.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {a.matched_skills.map((s) => (
                            <span key={s} className="badge bg-indigo-50 text-indigo-600">
                              {s}
                            </span>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">任务 ID</label>
          <input className="input" type="number" value={fTask} onChange={(e) => setFTask(e.target.value)} placeholder="过滤任务" />
        </div>
        <div>
          <label className="label">状态</label>
          <select className="input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">全部</option>
            {ASSIGN_STATUSES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          共 <span className="font-medium tabular-nums">{total}</span> 条分配记录
        </div>
        {loading ? (
          <Loading />
        ) : assignments.length === 0 ? (
          <Empty text="暂无分配记录" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">任务</th>
                <th className="th">样本</th>
                <th className="th">标注员</th>
                <th className="th">分配人</th>
                <th className="th">命中技能</th>
                <th className="th">得分</th>
                <th className="th">状态</th>
                <th className="th">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="td">
                    <div className="font-medium text-slate-800">{a.task_name || `#${a.task_id}`}</div>
                    <div className="text-xs text-slate-400">#{a.task_id}</div>
                  </td>
                  <td className="td text-slate-500">{a.unit_id ? `#${a.unit_id}` : '—'}</td>
                  <td className="td font-medium text-slate-700">{a.assignee}</td>
                  <td className="td text-slate-500">{a.assigned_by || '—'}</td>
                  <td className="td">
                    {a.matched_skills?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {a.matched_skills.map((s) => (
                          <span key={s} className="badge bg-indigo-50 text-indigo-600">
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="td tabular-nums">{a.score}</td>
                  <td className="td">
                    <Pill cls={ASSIGN_STATUS_CLS[a.status] || 'bg-slate-100 text-slate-600'}>
                      {a.status_label || labelOf(ASSIGN_STATUSES, a.status)}
                    </Pill>
                  </td>
                  <td className="td whitespace-nowrap text-xs text-slate-400">{formatTime(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---- Tab3：技能标签 ----

function SkillsTab({ canManage }: { canManage: boolean }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', category: '', task_type: '' });
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', category: '', task_type: '' });

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<Skill>(`/workforce/skills${qs({ pageSize: 100 })}`)
      .then((r) => {
        setSkills(r.list);
        setTotal(r.total);
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setErr('');
    if (!form.name.trim()) return setErr('请填写技能名称');
    setBusy(true);
    try {
      await fetchData('/workforce/skills', { method: 'POST', body: form });
      setForm({ name: '', category: '', task_type: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (s: Skill) => {
    setEditId(s.id);
    setEditForm({ name: s.name, category: s.category, task_type: s.task_type });
  };

  const saveEdit = async () => {
    if (editId === null) return;
    setErr('');
    setBusy(true);
    try {
      await fetchData(`/workforce/skills/${editId}`, { method: 'PATCH', body: editForm });
      setEditId(null);
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setErr('');
    try {
      await api(`/workforce/skills/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <Tags className="h-4 w-4 text-slate-400" /> 新增技能标签
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">名称 *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">分类</label>
              <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label className="label">任务类型</label>
              <input className="input" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })} placeholder="如 classification" />
            </div>
            <button className="btn-primary" onClick={create} disabled={busy}>
              <Plus className="h-4 w-4" /> 新增
            </button>
          </div>
        </div>
      )}

      {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          共 <span className="font-medium tabular-nums">{total}</span> 个技能
        </div>
        {loading ? (
          <Loading />
        ) : skills.length === 0 ? (
          <Empty text="暂无技能标签" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">名称</th>
                <th className="th">分类</th>
                <th className="th">任务类型</th>
                {canManage && <th className="th">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {skills.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  {editId === s.id ? (
                    <>
                      <td className="td">
                        <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                      </td>
                      <td className="td">
                        <input className="input" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
                      </td>
                      <td className="td">
                        <input className="input" value={editForm.task_type} onChange={(e) => setEditForm({ ...editForm, task_type: e.target.value })} />
                      </td>
                      <td className="td">
                        <div className="flex gap-1.5">
                          <button className="btn-primary !px-2" onClick={saveEdit} disabled={busy}>
                            保存
                          </button>
                          <button className="btn-secondary !px-2" onClick={() => setEditId(null)}>
                            取消
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="td font-medium text-slate-800">{s.name}</td>
                      <td className="td text-slate-500">{s.category || '—'}</td>
                      <td className="td text-slate-500">{s.task_type || '—'}</td>
                      {canManage && (
                        <td className="td">
                          <div className="flex gap-1.5">
                            <button className="btn-secondary !px-2" onClick={() => startEdit(s)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button className="btn-danger !px-2" onClick={() => remove(s.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---- Tab4：工时 ----

function WorklogsTab({ canManage, users }: { canManage: boolean; users: UserOption[] }) {
  const [logs, setLogs] = useState<Worklog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fTask, setFTask] = useState('');
  const [form, setForm] = useState({ assignee: '', task: '', assignment: '', effective_minutes: '', work_date: '', note: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<Worklog>(`/workforce/worklogs${qs({ task: fTask, pageSize: 50 })}`)
      .then((r) => {
        setLogs(r.list);
        setTotal(r.total);
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [fTask]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setErr('');
    if (!form.assignee || !form.effective_minutes) return setErr('请选择标注员并填写有效工时');
    setBusy(true);
    try {
      const body: any = {
        assignee: Number(form.assignee),
        effective_minutes: Number(form.effective_minutes),
        note: form.note,
      };
      if (form.task.trim()) body.task = Number(form.task);
      if (form.assignment.trim()) body.assignment = Number(form.assignment);
      if (form.work_date) body.work_date = form.work_date;
      await fetchData('/workforce/worklogs', { method: 'POST', body });
      setForm({ assignee: '', task: '', assignment: '', effective_minutes: '', work_date: '', note: '' });
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
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <Clock className="h-4 w-4 text-slate-400" /> 登记工时
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">标注员 *</label>
              <select className="input" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
                <option value="">请选择</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name || u.username}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">任务 ID</label>
              <input className="input !w-24" type="number" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} />
            </div>
            <div>
              <label className="label">分配 ID</label>
              <input className="input !w-24" type="number" value={form.assignment} onChange={(e) => setForm({ ...form, assignment: e.target.value })} />
            </div>
            <div>
              <label className="label">有效工时(分钟) *</label>
              <input
                className="input !w-32"
                type="number"
                value={form.effective_minutes}
                onChange={(e) => setForm({ ...form, effective_minutes: e.target.value })}
              />
            </div>
            <div>
              <label className="label">工作日期</label>
              <input className="input" type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} />
            </div>
            <div className="min-w-[10rem] flex-1">
              <label className="label">备注</label>
              <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={create} disabled={busy}>
              <Plus className="h-4 w-4" /> 登记
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">任务 ID</label>
          <input className="input" type="number" value={fTask} onChange={(e) => setFTask(e.target.value)} placeholder="过滤任务" />
        </div>
      </div>

      {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          共 <span className="font-medium tabular-nums">{total}</span> 条工时记录
        </div>
        {loading ? (
          <Loading />
        ) : logs.length === 0 ? (
          <Empty text="暂无工时记录" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">标注员</th>
                <th className="th">任务</th>
                <th className="th">分配</th>
                <th className="th">有效工时</th>
                <th className="th">工作日期</th>
                <th className="th">备注</th>
                <th className="th">登记时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-700">{l.assignee}</td>
                  <td className="td text-slate-500">{l.task_id ? l.task_name || `#${l.task_id}` : '—'}</td>
                  <td className="td text-slate-500">{l.assignment_id ? `#${l.assignment_id}` : '—'}</td>
                  <td className="td tabular-nums">{l.effective_minutes} 分钟</td>
                  <td className="td text-slate-500">{l.work_date || '—'}</td>
                  <td className="td max-w-xs truncate text-slate-500">{l.note || '—'}</td>
                  <td className="td whitespace-nowrap text-xs text-slate-400">{formatTime(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---- Tab5：薪酬与排班 ----

function PayTab({ canManage, users }: { canManage: boolean; users: UserOption[] }) {
  const [schemes, setSchemes] = useState<PayScheme[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [schemeForm, setSchemeForm] = useState({ name: '', mode: 'piece', rate: '', currency: 'CNY', task_type: '', description: '' });
  const [shiftForm, setShiftForm] = useState({ name: '', assignee: '', start_at: '', end_at: '', capacity: '0', note: '' });

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    Promise.all([
      fetchList<PayScheme>('/workforce/pay-schemes?pageSize=100').then((r) => r.list),
      fetchList<Shift>('/workforce/shifts?pageSize=100').then((r) => r.list),
    ])
      .then(([s, sh]) => {
        setSchemes(s);
        setShifts(sh);
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createScheme = async () => {
    setErr('');
    if (!schemeForm.name.trim() || !schemeForm.rate) return setErr('请填写方案名称与单价');
    setBusy(true);
    try {
      await fetchData('/workforce/pay-schemes', { method: 'POST', body: { ...schemeForm, rate: schemeForm.rate } });
      setSchemeForm({ name: '', mode: 'piece', rate: '', currency: 'CNY', task_type: '', description: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeScheme = async (id: number) => {
    setErr('');
    try {
      await api(`/workforce/pay-schemes/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const createShift = async () => {
    setErr('');
    if (!shiftForm.name.trim() || !shiftForm.start_at || !shiftForm.end_at) return setErr('请填写班次名称与起止时间');
    setBusy(true);
    try {
      const body: any = {
        name: shiftForm.name,
        start_at: shiftForm.start_at,
        end_at: shiftForm.end_at,
        capacity: Number(shiftForm.capacity) || 0,
        note: shiftForm.note,
      };
      if (shiftForm.assignee) body.assignee = Number(shiftForm.assignee);
      await fetchData('/workforce/shifts', { method: 'POST', body });
      setShiftForm({ name: '', assignee: '', start_at: '', end_at: '', capacity: '0', note: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeShift = async (id: number) => {
    setErr('');
    try {
      await api(`/workforce/shifts/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>}

      {/* 计薪方案 */}
      <div className="card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Wallet className="h-4 w-4 text-slate-400" /> 计薪方案
        </h3>
        {canManage && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label">名称 *</label>
              <input className="input" value={schemeForm.name} onChange={(e) => setSchemeForm({ ...schemeForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">计薪方式</label>
              <select className="input" value={schemeForm.mode} onChange={(e) => setSchemeForm({ ...schemeForm, mode: e.target.value })}>
                {PAY_MODES.map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">单价 *</label>
              <input className="input !w-28" type="number" value={schemeForm.rate} onChange={(e) => setSchemeForm({ ...schemeForm, rate: e.target.value })} />
            </div>
            <div>
              <label className="label">币种</label>
              <input className="input !w-20" value={schemeForm.currency} onChange={(e) => setSchemeForm({ ...schemeForm, currency: e.target.value })} />
            </div>
            <div>
              <label className="label">任务类型</label>
              <input className="input" value={schemeForm.task_type} onChange={(e) => setSchemeForm({ ...schemeForm, task_type: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={createScheme} disabled={busy}>
              <Plus className="h-4 w-4" /> 新增
            </button>
          </div>
        )}
        {schemes.length === 0 ? (
          <Empty text="暂无计薪方案" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">名称</th>
                <th className="th">方式</th>
                <th className="th">单价</th>
                <th className="th">币种</th>
                <th className="th">任务类型</th>
                {canManage && <th className="th">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schemes.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-800">{s.name}</td>
                  <td className="td text-slate-500">{s.mode_label || labelOf(PAY_MODES, s.mode)}</td>
                  <td className="td tabular-nums">{s.rate}</td>
                  <td className="td text-slate-500">{s.currency}</td>
                  <td className="td text-slate-500">{s.task_type || '—'}</td>
                  {canManage && (
                    <td className="td">
                      <button className="btn-danger !px-2" onClick={() => removeScheme(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 班次 */}
      <div className="card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Clock className="h-4 w-4 text-slate-400" /> 班次排班
        </h3>
        {canManage && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label">名称 *</label>
              <input className="input" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">负责人</label>
              <select className="input" value={shiftForm.assignee} onChange={(e) => setShiftForm({ ...shiftForm, assignee: e.target.value })}>
                <option value="">（不限）</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name || u.username}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">开始 *</label>
              <input className="input" type="datetime-local" value={shiftForm.start_at} onChange={(e) => setShiftForm({ ...shiftForm, start_at: e.target.value })} />
            </div>
            <div>
              <label className="label">结束 *</label>
              <input className="input" type="datetime-local" value={shiftForm.end_at} onChange={(e) => setShiftForm({ ...shiftForm, end_at: e.target.value })} />
            </div>
            <div>
              <label className="label">容量</label>
              <input className="input !w-20" type="number" value={shiftForm.capacity} onChange={(e) => setShiftForm({ ...shiftForm, capacity: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={createShift} disabled={busy}>
              <Plus className="h-4 w-4" /> 新增
            </button>
          </div>
        )}
        {shifts.length === 0 ? (
          <Empty text="暂无班次" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">名称</th>
                <th className="th">负责人</th>
                <th className="th">开始</th>
                <th className="th">结束</th>
                <th className="th">容量</th>
                {canManage && <th className="th">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shifts.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-800">{s.name}</td>
                  <td className="td text-slate-500">{s.assignee || '—'}</td>
                  <td className="td whitespace-nowrap text-slate-500">{formatTime(s.start_at)}</td>
                  <td className="td whitespace-nowrap text-slate-500">{formatTime(s.end_at)}</td>
                  <td className="td tabular-nums">{s.capacity}</td>
                  {canManage && (
                    <td className="td">
                      <button className="btn-danger !px-2" onClick={() => removeShift(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
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
  );
}

// ---- Tab6：工时预估 + 外包 ----

function EstimateTab({ canManage }: { canManage: boolean }) {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [estimateTask, setEstimateTask] = useState('');
  const [result, setResult] = useState<{ estimate_id: number; estimated_minutes: number; method: string; sample_size: number; basis: any } | null>(null);

  const [vendorForm, setVendorForm] = useState({ name: '', vendor: '', isolation_key: '', is_isolated: true, contact: '', capacity: '0' });

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    Promise.all([
      fetchList<Estimate>('/workforce/estimates?pageSize=50').then((r) => r.list),
      fetchList<Vendor>('/workforce/vendors?pageSize=50').then((r) => r.list),
    ])
      .then(([e, v]) => {
        setEstimates(e);
        setVendors(v);
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const estimate = async () => {
    setErr('');
    setResult(null);
    if (!estimateTask.trim()) return setErr('请填写任务 ID');
    setBusy(true);
    try {
      const res = await fetchData<{ estimate_id: number; estimated_minutes: number; method: string; sample_size: number; basis: any }>(
        '/workforce/estimate',
        { method: 'POST', body: { task: Number(estimateTask) } }
      );
      setResult(res);
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createVendor = async () => {
    setErr('');
    if (!vendorForm.name.trim() || !vendorForm.isolation_key.trim()) return setErr('请填写团队名称与隔离标识');
    setBusy(true);
    try {
      await fetchData('/workforce/vendors', {
        method: 'POST',
        body: { ...vendorForm, capacity: Number(vendorForm.capacity) || 0 },
      });
      setVendorForm({ name: '', vendor: '', isolation_key: '', is_isolated: true, contact: '', capacity: '0' });
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeVendor = async (id: number) => {
    setErr('');
    try {
      await api(`/workforce/vendors/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>}

      {/* 工时预估 */}
      <div className="card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Calculator className="h-4 w-4 text-slate-400" /> 工时预估（基于历史工时均值）
        </h3>
        {canManage && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label">任务 ID *</label>
              <input className="input" type="number" value={estimateTask} onChange={(e) => setEstimateTask(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={estimate} disabled={busy}>
              {busy ? '预估中…' : '开始预估'}
            </button>
          </div>
        )}
        {result && (
          <div className="mb-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            预估工时：<span className="font-medium tabular-nums">{result.estimated_minutes}</span> 分钟 · 方法 {result.method} · 样本量{' '}
            <span className="tabular-nums">{result.sample_size}</span>
            {result.basis && <div className="mt-1 text-xs text-slate-400">依据：{JSON.stringify(result.basis)}</div>}
          </div>
        )}
        {estimates.length === 0 ? (
          <Empty text="暂无预估记录" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">任务</th>
                <th className="th">预估工时</th>
                <th className="th">方法</th>
                <th className="th">样本量</th>
                <th className="th">创建人</th>
                <th className="th">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {estimates.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="td">
                    <div className="font-medium text-slate-800">{e.task_name || `#${e.task_id}`}</div>
                    <div className="text-xs text-slate-400">#{e.task_id}</div>
                  </td>
                  <td className="td tabular-nums">{e.estimated_minutes} 分钟</td>
                  <td className="td text-slate-500">{e.method}</td>
                  <td className="td tabular-nums">{e.sample_size}</td>
                  <td className="td text-slate-500">{e.created_by || '—'}</td>
                  <td className="td whitespace-nowrap text-xs text-slate-400">{formatTime(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 外包团队 */}
      <div className="card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Building2 className="h-4 w-4 text-slate-400" /> 外包团队（数据隔离）
        </h3>
        {canManage && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label">团队名称 *</label>
              <input className="input" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">供应商</label>
              <input className="input" value={vendorForm.vendor} onChange={(e) => setVendorForm({ ...vendorForm, vendor: e.target.value })} />
            </div>
            <div>
              <label className="label">隔离标识 *</label>
              <input className="input" value={vendorForm.isolation_key} onChange={(e) => setVendorForm({ ...vendorForm, isolation_key: e.target.value })} />
            </div>
            <div>
              <label className="label">联系人</label>
              <input className="input" value={vendorForm.contact} onChange={(e) => setVendorForm({ ...vendorForm, contact: e.target.value })} />
            </div>
            <div>
              <label className="label">容量</label>
              <input className="input !w-20" type="number" value={vendorForm.capacity} onChange={(e) => setVendorForm({ ...vendorForm, capacity: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={vendorForm.is_isolated} onChange={(e) => setVendorForm({ ...vendorForm, is_isolated: e.target.checked })} />
              数据隔离
            </label>
            <button className="btn-primary" onClick={createVendor} disabled={busy}>
              <Plus className="h-4 w-4" /> 新增
            </button>
          </div>
        )}
        {vendors.length === 0 ? (
          <Empty text="暂无外包团队" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">团队</th>
                <th className="th">供应商</th>
                <th className="th">隔离标识</th>
                <th className="th">隔离</th>
                <th className="th">联系人</th>
                <th className="th">容量</th>
                {canManage && <th className="th">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-800">{v.name}</td>
                  <td className="td text-slate-500">{v.vendor || '—'}</td>
                  <td className="td">
                    <span className="badge bg-slate-100 text-slate-600">{v.isolation_key}</span>
                  </td>
                  <td className="td">
                    <Pill cls={v.is_isolated ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}>
                      {v.is_isolated ? '已隔离' : '未隔离'}
                    </Pill>
                  </td>
                  <td className="td text-slate-500">{v.contact || '—'}</td>
                  <td className="td tabular-nums">{v.capacity}</td>
                  {canManage && (
                    <td className="td">
                      <button className="btn-danger !px-2" onClick={() => removeVendor(v.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
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
  );
}
