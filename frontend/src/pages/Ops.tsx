import { useEffect, useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { fetchData, fetchList, api } from '../api';
import { useAuth } from '../auth';
import { TaskItem } from '../types';
import { Loading, Empty, Stat } from '../components/common';

type TabKey = 'dashboard' | 'announcements' | 'comments' | 'reports' | 'leaderboard' | 'feedback';

const ROLE_OPTIONS: [string, string][] = [
  ['admin', '管理员'],
  ['operator', '标注运营'],
  ['annotator', '标注员'],
  ['engineer', '算法工程师'],
  ['pm', '项目经理'],
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_OPTIONS);

const dt = (s?: string | null) => (s ? s.slice(0, 16).replace('T', ' ') : '—');

export default function Ops() {
  const { isRole } = useAuth();
  const canManage = isRole('admin', 'operator', 'pm');
  const [tab, setTab] = useState<TabKey>('dashboard');

  const tabs: [TabKey, string][] = [
    ['dashboard', '数据看板'],
    ['announcements', '公告与通知'],
    ['comments', '任务评论'],
    ['reports', '运营报表'],
    ['leaderboard', '排行榜'],
    ['feedback', '反馈'],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">运营与协作</h1>
        <p className="text-sm text-slate-500">运营数据看板、公告通知、协作评论、报表、排行榜与用户反馈</p>
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
      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'announcements' && <AnnouncementsTab canManage={canManage} />}
      {tab === 'comments' && <CommentsTab canManage={canManage} />}
      {tab === 'reports' && <ReportsTab canManage={canManage} />}
      {tab === 'leaderboard' && <LeaderboardTab />}
      {tab === 'feedback' && <FeedbackTab canHandle={canManage} />}
    </div>
  );
}

// ---------------- 数据看板 ----------------
interface OpsDashboard {
  tasks: { total: number; by_status: Record<string, number>; by_type: Record<string, number> };
  units: { total: number; prelabeled: number; auto_approved: number; pending_review: number; reviewed: number };
  rates: { ai_auto_pass_rate: number; human_modify_rate: number };
  recent_trend: { date: string; units: number }[];
}

function DashboardTab() {
  const [data, setData] = useState<OpsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const load = () => {
    setLoading(true);
    setErr('');
    fetchData<OpsDashboard>('/ops/dashboard')
      .then(setData)
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <Loading />;
  if (err) return <Empty text={err} />;
  if (!data) return <Empty text="暂无数据" />;

  const maxUnits = Math.max(1, ...data.recent_trend.map((t) => t.units));
  const pct = (v: number) => (v * 100).toFixed(1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="任务总数" value={data.tasks.total} />
        <Stat label="数据样本" value={data.units.total} />
        <Stat label="已 AI 预标注" value={data.units.prelabeled} />
        <Stat label="AI 自动通过" value={data.units.auto_approved} />
        <Stat label="待人工审核" value={data.units.pending_review} />
        <Stat label="已审核" value={data.units.reviewed} />
        <Stat label="AI 自动通过率" value={pct(data.rates.ai_auto_pass_rate)} suffix="%" />
        <Stat label="人工修正率" value={pct(data.rates.human_modify_rate)} suffix="%" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-medium text-slate-700">近 7 天新增样本趋势</h3>
          <div className="flex h-40 items-end gap-2">
            {data.recent_trend.map((t) => (
              <div key={t.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-indigo-500"
                  style={{ height: `${(t.units / maxUnits) * 100}%`, minHeight: t.units ? 3 : 0 }}
                />
                <span className="text-[10px] text-slate-400">{t.date.slice(5)}</span>
                <span className="text-[10px] tabular-nums text-slate-500">{t.units}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-medium text-slate-700">任务状态 / 类型分布</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="mb-2 font-medium text-slate-500">按状态</div>
              {Object.keys(data.tasks.by_status).length === 0 ? (
                <span className="text-slate-300">—</span>
              ) : (
                <ul className="space-y-1">
                  {Object.entries(data.tasks.by_status).map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span className="text-slate-500">{k}</span>
                      <span className="tabular-nums text-slate-700">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-2 font-medium text-slate-500">按类型</div>
              {Object.keys(data.tasks.by_type).length === 0 ? (
                <span className="text-slate-300">—</span>
              ) : (
                <ul className="space-y-1">
                  {Object.entries(data.tasks.by_type).map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span className="text-slate-500">{k}</span>
                      <span className="tabular-nums text-slate-700">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- 公告与通知 ----------------
interface Announcement {
  id: number;
  title: string;
  level: string;
  level_label: string;
  target_roles: string[];
  published: boolean;
  published_at: string | null;
  created_by: string;
  created_at: string;
  content?: string;
}

const LEVEL_META: Record<string, string> = {
  info: 'bg-sky-50 text-sky-600',
  warning: 'bg-amber-50 text-amber-600',
  urgent: 'bg-rose-50 text-rose-600',
};

function AnnouncementsTab({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    setErr('');
    fetchList<Announcement>('/ops/announcements')
      .then((r) => setItems(r.list))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const publish = async (id: number) => {
    setErr('');
    try {
      await fetchData(`/ops/announcements/${id}/publish`, { method: 'POST' });
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
            <Plus className="h-4 w-4" /> 新建公告
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="暂无公告" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">标题</th>
                <th className="th">级别</th>
                <th className="th">目标角色</th>
                <th className="th">状态</th>
                <th className="th">创建人</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="td max-w-xs">
                    <div className="font-medium text-slate-800">{a.title}</div>
                    <div className="text-xs text-slate-400">{dt(a.created_at)}</div>
                  </td>
                  <td className="td">
                    <span className={`badge ${LEVEL_META[a.level] || 'bg-slate-100 text-slate-600'}`}>{a.level_label}</span>
                  </td>
                  <td className="td">
                    {a.target_roles?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {a.target_roles.map((r) => (
                          <span key={r} className="badge bg-slate-100 text-slate-500">{ROLE_LABEL[r] || r}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">全员</span>
                    )}
                  </td>
                  <td className="td">
                    <span className={`badge ${a.published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {a.published ? '已发布' : '未发布'}
                    </span>
                    {a.published_at && <div className="mt-1 text-[11px] text-slate-400">{dt(a.published_at)}</div>}
                  </td>
                  <td className="td text-xs text-slate-500">{a.created_by}</td>
                  <td className="td text-right">
                    {canManage && !a.published && (
                      <button className="btn-secondary" onClick={() => publish(a.id)}>发布</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {err && <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-600">{err}</div>}
      </div>

      <NotificationsSection />

      {showCreate && <CreateAnnouncementModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function NotificationsSection() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    fetchList<Notification>('/ops/notifications')
      .then((r) => setItems(r.list))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const readOne = async (id: number) => {
    try {
      await fetchData(`/ops/notifications/${id}/read`, { method: 'POST' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const readAll = async () => {
    try {
      await fetchData('/ops/notifications/read-all', { method: 'POST' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="text-sm font-medium text-slate-700">我的通知</div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">未读 {unread}</span>
          <button className="btn-secondary" onClick={readAll}>全部已读</button>
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty text="暂无通知" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 flex-none rounded-full ${n.is_read ? 'bg-slate-200' : 'bg-indigo-500'}`} />
                  <span className="truncate text-sm font-medium text-slate-800">{n.title}</span>
                  {n.category && <span className="badge bg-slate-100 text-slate-500">{n.category}</span>}
                </div>
                <div className="mt-1 truncate text-xs text-slate-500">{n.content}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">{dt(n.created_at)}</div>
              </div>
              {!n.is_read && (
                <button className="flex flex-none items-center gap-1 text-xs text-indigo-600 hover:underline" onClick={() => readOne(n.id)}>
                  <Check className="h-3.5 w-3.5" /> 标记已读
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {err && <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-600">{err}</div>}
    </div>
  );
}

interface Notification {
  id: number;
  title: string;
  content: string;
  category: string;
  is_read: boolean;
  ref_type: string;
  ref_id: string;
  created_at: string;
}

function CreateAnnouncementModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', content: '', level: 'info', published: false });
  const [roles, setRoles] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleRole = (r: string) => setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const submit = async () => {
    setErr('');
    if (!form.title.trim()) return setErr('请填写公告标题');
    setBusy(true);
    try {
      await fetchData('/ops/announcements', { method: 'POST', body: { ...form, target_roles: roles } });
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
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">新建公告</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="label">标题 *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">内容</label><textarea className="input" rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          <div>
            <label className="label">级别</label>
            <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              <option value="info">通知</option>
              <option value="warning">警告</option>
              <option value="urgent">紧急</option>
            </select>
          </div>
          <div>
            <label className="label">目标角色（不选为全员）</label>
            <div className="flex flex-wrap gap-3">
              {ROLE_OPTIONS.map(([k, v]) => (
                <label key={k} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={roles.includes(k)} onChange={() => toggleRole(k)} /> {v}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
            创建后立即标记为已发布
          </label>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '提交中…' : '创建'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- 任务评论 ----------------
interface CommentRow {
  id: number;
  task_id: number;
  unit_id: number | null;
  author: string;
  content: string;
  parent_id: number | null;
  mentions: string[];
  created_at: string;
}

function CommentsTab({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<CommentRow[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskFilter, setTaskFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    setErr('');
    const path = taskFilter ? `/ops/comments?task=${taskFilter}` : '/ops/comments';
    fetchList<CommentRow>(path)
      .then((r) => setItems(r.list))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [taskFilter]);
  useEffect(() => {
    api<TaskItem[]>('/tasks').then(setTasks).catch(() => undefined);
  }, []);

  const taskName = (id: number) => tasks.find((t) => t.id === id)?.name || `#${id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select className="input max-w-xs" value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)}>
          <option value="">全部任务</option>
          {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 发表评论
          </button>
        )}
      </div>
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="暂无评论" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{c.author}</span>
                  <span>·</span>
                  <span>{taskName(c.task_id)}</span>
                  {c.unit_id && <span className="text-slate-400">单元 #{c.unit_id}</span>}
                  <span className="text-slate-300">{dt(c.created_at)}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.content}</div>
                {c.mentions?.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.mentions.map((m) => <span key={m} className="badge bg-indigo-50 text-indigo-600">@{m}</span>)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {err && <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-600">{err}</div>}
      </div>

      {showCreate && (
        <CreateCommentModal
          tasks={tasks}
          defaultTask={taskFilter}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}

function CreateCommentModal({
  tasks,
  defaultTask,
  onClose,
  onCreated,
}: {
  tasks: TaskItem[];
  defaultTask: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ task: defaultTask, content: '', mentions: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!form.task) return setErr('请选择任务');
    if (!form.content.trim()) return setErr('请填写评论内容');
    setBusy(true);
    try {
      await fetchData('/ops/comments', {
        method: 'POST',
        body: {
          task: Number(form.task),
          content: form.content,
          mentions: form.mentions.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean),
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
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">发表评论</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">任务 *</label>
            <select className="input" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })}>
              <option value="">请选择任务</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div><label className="label">内容 *</label><textarea className="input" rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          <div><label className="label">提及用户（逗号分隔）</label><input className="input" value={form.mentions} onChange={(e) => setForm({ ...form, mentions: e.target.value })} /></div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '提交中…' : '发表'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- 运营报表 ----------------
interface ReportRow {
  id: number;
  report_type: string;
  report_type_label: string;
  period_start: string;
  period_end: string;
  status: string;
  status_label: string;
  generated_by: string;
  created_at: string;
}

interface ReportDetail extends ReportRow {
  metrics: Record<string, number>;
}

function ReportsTab({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ report_type: 'daily', period_start: '', period_end: '' });
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<ReportDetail | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    fetchList<ReportRow>('/ops/reports')
      .then((r) => setItems(r.list))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const generate = async () => {
    setErr('');
    setBusy(true);
    try {
      const body: Record<string, unknown> = { report_type: form.report_type };
      if (form.period_start) body.period_start = form.period_start;
      if (form.period_end) body.period_end = form.period_end;
      const report = await fetchData<ReportDetail>('/ops/reports/generate', { method: 'POST', body });
      setGenerated(report);
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
          <div className="mb-3 text-sm font-medium text-slate-700">生成报表</div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">类型</label>
              <select className="input" value={form.report_type} onChange={(e) => setForm({ ...form, report_type: e.target.value })}>
                <option value="daily">日报</option>
                <option value="weekly">周报</option>
              </select>
            </div>
            <div>
              <label className="label">周期开始（可空）</label>
              <input className="input" type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
            </div>
            <div>
              <label className="label">周期结束（可空）</label>
              <input className="input" type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={generate} disabled={busy}>{busy ? '生成中…' : '生成报表'}</button>
          </div>
          {generated && (
            <div className="mt-3 rounded-md bg-indigo-50 p-3">
              <div className="mb-1 text-xs font-medium text-indigo-700">
                已生成：{generated.report_type_label} {generated.period_start} ~ {generated.period_end}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-indigo-600">
                {Object.entries(generated.metrics || {}).map(([k, v]) => (
                  <span key={k} className="rounded bg-white/70 px-1.5 py-0.5">{k}: {String(v)}</span>
                ))}
              </div>
            </div>
          )}
          {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
        </div>
      )}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="暂无报表" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">类型</th>
                <th className="th">周期</th>
                <th className="th">状态</th>
                <th className="th">生成人</th>
                <th className="th">生成时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="td"><span className="badge bg-indigo-50 text-indigo-600">{r.report_type_label}</span></td>
                  <td className="td tabular-nums text-xs text-slate-600">{r.period_start} ~ {r.period_end}</td>
                  <td className="td text-xs text-slate-500">{r.status_label}</td>
                  <td className="td text-xs text-slate-500">{r.generated_by || '—'}</td>
                  <td className="td text-xs text-slate-400">{dt(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------- 排行榜 ----------------
interface LeaderboardItem {
  annotator_id: number;
  username: string;
  output: number;
  accuracy: number;
  rank: number;
}

function LeaderboardTab() {
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sortBy, setSortBy] = useState('accuracy');
  const [anonymous, setAnonymous] = useState(false);

  const load = () => {
    setLoading(true);
    setErr('');
    fetchData<{ leaderboard: LeaderboardItem[]; count: number }>(
      `/ops/leaderboard?sort_by=${sortBy}&anonymous=${anonymous ? 1 : 0}`
    )
      .then((r) => setItems(r.leaderboard || []))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [sortBy, anonymous]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">排序：</span>
          <select className="input w-40" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="accuracy">按准确率</option>
            <option value="output">按产量</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> 匿名展示
        </label>
      </div>
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : err ? (
          <Empty text={err} />
        ) : items.length === 0 ? (
          <Empty text="暂无排行数据" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th w-16">排名</th>
                <th className="th">标注员</th>
                <th className="th">产量（已审核）</th>
                <th className="th">准确率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it) => (
                <tr key={it.annotator_id} className="hover:bg-slate-50">
                  <td className="td">
                    <span className={`badge ${it.rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>#{it.rank}</span>
                  </td>
                  <td className="td font-medium text-slate-800">{it.username || '—'}</td>
                  <td className="td tabular-nums">{it.output}</td>
                  <td className="td tabular-nums">{(it.accuracy * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------- 反馈 ----------------
interface FeedbackRow {
  id: number;
  user: string;
  category: string;
  content: string;
  status: string;
  status_label: string;
  handled_by: string;
  created_at: string;
}

const FEEDBACK_META: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  closed: 'bg-emerald-100 text-emerald-700',
};

function FeedbackTab({ canHandle }: { canHandle: boolean }) {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ category: '', content: '' });
  const [busy, setBusy] = useState(false);
  const [handling, setHandling] = useState<FeedbackRow | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    fetchList<FeedbackRow>('/ops/feedbacks')
      .then((r) => setItems(r.list))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submit = async () => {
    setErr('');
    if (!form.content.trim()) return setErr('请填写反馈内容');
    setBusy(true);
    try {
      await fetchData('/ops/feedbacks', { method: 'POST', body: { category: form.category, content: form.content } });
      setForm({ category: '', content: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 text-sm font-medium text-slate-700">提交反馈</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="label">分类</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="如 bug / 建议" />
          </div>
          <div className="min-w-[16rem] flex-1">
            <label className="label">内容 *</label>
            <input className="input" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '提交中…' : '提交'}</button>
        </div>
        {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="暂无反馈" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">提交人</th>
                <th className="th">分类</th>
                <th className="th">内容</th>
                <th className="th">状态</th>
                <th className="th">处理人</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="td text-xs text-slate-600">
                    <div>{f.user || '—'}</div>
                    <div className="text-[11px] text-slate-400">{dt(f.created_at)}</div>
                  </td>
                  <td className="td text-xs text-slate-500">{f.category || '—'}</td>
                  <td className="td max-w-md text-sm text-slate-700">{f.content}</td>
                  <td className="td">
                    <span className={`badge ${FEEDBACK_META[f.status] || 'bg-slate-100 text-slate-600'}`}>{f.status_label}</span>
                  </td>
                  <td className="td text-xs text-slate-500">{f.handled_by || '—'}</td>
                  <td className="td text-right">
                    {canHandle && (
                      <button className="btn-secondary" onClick={() => setHandling(f)}>处理</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {handling && (
        <HandleFeedbackModal
          feedback={handling}
          onClose={() => setHandling(null)}
          onHandled={() => {
            setHandling(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function HandleFeedbackModal({
  feedback,
  onClose,
  onHandled,
}: {
  feedback: FeedbackRow;
  onClose: () => void;
  onHandled: () => void;
}) {
  const [status, setStatus] = useState('processing');
  const [response, setResponse] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      await fetchData(`/ops/feedbacks/${feedback.id}/handle`, { method: 'POST', body: { status, response } });
      onHandled();
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
          <h2 className="text-lg font-semibold">处理反馈</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">{feedback.content}</div>
          <div>
            <label className="label">状态</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open">待处理</option>
              <option value="processing">处理中</option>
              <option value="closed">已关闭</option>
            </select>
          </div>
          <div><label className="label">处理回复</label><textarea className="input" rows={3} value={response} onChange={(e) => setResponse(e.target.value)} /></div>
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
