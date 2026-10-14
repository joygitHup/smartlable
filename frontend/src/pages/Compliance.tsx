import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2, Droplet, Play, ShieldCheck } from 'lucide-react';
import { fetchData, fetchList } from '../api';
import { useAuth } from '../auth';
import { Loading, Empty } from '../components/common';

// ---- 通用工具 ----
const LEVEL_OPTIONS: [string, string][] = [
  ['public', '公开'],
  ['internal', '内部'],
  ['confidential', '机密'],
  ['secret', '绝密'],
];

const LEVEL_COLOR: Record<string, string> = {
  public: 'bg-slate-100 text-slate-600',
  internal: 'bg-sky-100 text-sky-700',
  confidential: 'bg-amber-100 text-amber-700',
  secret: 'bg-rose-100 text-rose-700',
};

const FRAMEWORK_OPTIONS: [string, string][] = [
  ['GDPR', 'GDPR'],
  ['PIPL', '个人信息保护法'],
  ['other', '其他'],
];

const ACTION_OPTIONS: [string, string][] = [
  ['delete', '删除'],
  ['archive', '归档'],
];

function fmt(dt?: string | null) {
  return dt ? dt.slice(0, 16).replace('T', ' ') : '—';
}

function LevelBadge({ level, label }: { level: string; label?: string }) {
  return (
    <span className={`badge ${LEVEL_COLOR[level] || 'bg-slate-100 text-slate-600'}`}>
      {label || level}
    </span>
  );
}

function useList<T>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetchList<T>(path)
      .then((d) => setItems(d.list))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  return { items, loading, error, reload: load };
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
      {label}
    </label>
  );
}

function RowActions({
  canManage,
  onEdit,
  onDelete,
  busyId,
  id,
}: {
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  busyId: number | null;
  id: number;
}) {
  if (!canManage) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex gap-1">
      <button onClick={onEdit} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="编辑">
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={onDelete}
        disabled={busyId === id}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-40"
        title="删除"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---- 类型 ----
interface Classification {
  id: number; name: string; level: string; level_label: string; description: string;
  created_by: string; created_at: string; updated_at: string;
}
interface Policy {
  id: number; task_type: string; level: string; level_label: string; allowed_roles: string[];
  require_secure_env: boolean; created_by: string; created_at: string;
}
interface Watermark {
  id: number; target_type: string; target_id: string; text: string; token: string; hash: string;
  created_by: string; created_at: string;
}
interface Environment {
  id: number; name: string; level: string; level_label: string; allow_screenshot: boolean;
  allow_copy: boolean; require_approval: boolean; enabled: boolean; created_by: string; created_at: string;
}
interface AuditLog {
  id: number; user: string; action: string; target_type: string; target_id: string;
  detail: any; ip: string; created_at: string;
}
interface LifecyclePolicy {
  id: number; level: string; level_label: string; retention_days: number; action: string;
  action_label: string; applies_to_task_type: string; enabled: boolean; created_by: string; created_at: string;
}
interface Checklist {
  id: number; framework: string; framework_label: string; item: string; description: string;
  required: boolean; created_by: string; created_at: string;
}
interface CheckResult {
  id: number; checklist_id: number; item: string; framework: string; status: string;
  status_label: string; checked_by: string; note: string; created_at: string;
}

const TABS: [string, string][] = [
  ['classification', '数据分级'],
  ['watermark', '水印溯源'],
  ['environment', '环境隔离'],
  ['audit', '操作审计'],
  ['lifecycle', '生命周期'],
  ['checklist', '合规检查'],
];

export default function Compliance() {
  const { isRole } = useAuth();
  const canManage = isRole('admin');
  const [tab, setTab] = useState('classification');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <ShieldCheck className="h-5 w-5 text-indigo-600" /> 数据安全与合规
        </h1>
        <p className="text-sm text-slate-500">数据分级、水印溯源、环境隔离、操作审计、生命周期与合规检查</p>
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
      {tab === 'classification' && <ClassificationTab canManage={canManage} />}
      {tab === 'watermark' && <WatermarkTab canManage={canManage} />}
      {tab === 'environment' && <EnvironmentTab canManage={canManage} />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'lifecycle' && <LifecycleTab canManage={canManage} />}
      {tab === 'checklist' && <ChecklistTab canManage={canManage} />}
    </div>
  );
}

// ==================== F12.1 数据分级 ====================
function ClassificationTab({ canManage }: { canManage: boolean }) {
  const classes = useList<Classification>('/compliance/classifications');
  const policies = useList<Policy>('/compliance/policies');
  const [editC, setEditC] = useState<Classification | null>(null);
  const [showC, setShowC] = useState(false);
  const [editP, setEditP] = useState<Policy | null>(null);
  const [showP, setShowP] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const remove = async (path: string, id: number, reload: () => void) => {
    if (!window.confirm('确认删除？')) return;
    setBusy(id);
    try {
      await fetchData(`${path}/${id}`, { method: 'DELETE' });
      reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">数据分级分类</span>
          {canManage && (
            <button className="btn-secondary" onClick={() => { setEditC(null); setShowC(true); }}>
              <Plus className="h-4 w-4" /> 新增
            </button>
          )}
        </div>
        {classes.loading ? (
          <Loading />
        ) : classes.error ? (
          <div className="p-4 text-sm text-rose-600">{classes.error}</div>
        ) : classes.items.length === 0 ? (
          <Empty text="暂无分级分类" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr><th className="th">名称</th><th className="th">级别</th><th className="th">说明</th><th className="th">操作</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classes.items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-800">{c.name}</td>
                  <td className="td"><LevelBadge level={c.level} label={c.level_label} /></td>
                  <td className="td max-w-[16rem] truncate text-xs text-slate-500">{c.description || '—'}</td>
                  <td className="td">
                    <RowActions canManage={canManage} id={c.id} busyId={busy} onEdit={() => { setEditC(c); setShowC(true); }} onDelete={() => remove('/compliance/classifications', c.id, classes.reload)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">分级访问策略</span>
          {canManage && (
            <button className="btn-secondary" onClick={() => { setEditP(null); setShowP(true); }}>
              <Plus className="h-4 w-4" /> 新增
            </button>
          )}
        </div>
        {policies.loading ? (
          <Loading />
        ) : policies.error ? (
          <div className="p-4 text-sm text-rose-600">{policies.error}</div>
        ) : policies.items.length === 0 ? (
          <Empty text="暂无访问策略" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr><th className="th">任务类型</th><th className="th">级别</th><th className="th">允许角色</th><th className="th">安全环境</th><th className="th">操作</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {policies.items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="td text-slate-700">{p.task_type}</td>
                  <td className="td"><LevelBadge level={p.level} label={p.level_label} /></td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {p.allowed_roles.length ? p.allowed_roles.map((r) => <span key={r} className="badge bg-slate-100 text-slate-500">{r}</span>) : <span className="text-slate-300">—</span>}
                    </div>
                  </td>
                  <td className="td">{p.require_secure_env ? <span className="badge bg-indigo-100 text-indigo-700">需隔离</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="td">
                    <RowActions canManage={canManage} id={p.id} busyId={busy} onEdit={() => { setEditP(p); setShowP(true); }} onDelete={() => remove('/compliance/policies', p.id, policies.reload)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showC && <ClassificationModal initial={editC} onClose={() => setShowC(false)} onSaved={classes.reload} />}
      {showP && <PolicyModal initial={editP} onClose={() => setShowP(false)} onSaved={policies.reload} />}
    </div>
  );
}

function ClassificationModal({ initial, onClose, onSaved }: { initial: Classification | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: initial?.name || '', level: initial?.level || 'internal', description: initial?.description || '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (!form.name.trim()) return setErr('请填写分类名称');
    setBusy(true);
    try {
      if (initial) await fetchData(`/compliance/classifications/${initial.id}`, { method: 'PATCH', body: form });
      else await fetchData('/compliance/classifications', { method: 'POST', body: form });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? '编辑分类' : '新增分类'} onClose={onClose}>
      <div><label className="label">分类名称 *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><label className="label">数据级别</label>
        <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
          {LEVEL_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div><label className="label">说明</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
      </div>
    </Modal>
  );
}

function PolicyModal({ initial, onClose, onSaved }: { initial: Policy | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    task_type: initial?.task_type || '',
    level: initial?.level || 'internal',
    allowed_roles: initial?.allowed_roles?.join(',') || '',
    require_secure_env: initial?.require_secure_env ?? false,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (!form.task_type.trim()) return setErr('请填写任务类型');
    setBusy(true);
    try {
      const body = {
        task_type: form.task_type.trim(),
        level: form.level,
        allowed_roles: form.allowed_roles.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        require_secure_env: form.require_secure_env,
      };
      if (initial) await fetchData(`/compliance/policies/${initial.id}`, { method: 'PATCH', body });
      else await fetchData('/compliance/policies', { method: 'POST', body });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? '编辑策略' : '新增策略'} onClose={onClose}>
      <div><label className="label">任务类型 *</label><input className="input" placeholder="classification / sentiment / entity" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })} /></div>
      <div><label className="label">数据级别</label>
        <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
          {LEVEL_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div><label className="label">允许角色（逗号分隔）</label><input className="input" placeholder="admin,annotator" value={form.allowed_roles} onChange={(e) => setForm({ ...form, allowed_roles: e.target.value })} /></div>
      <Check label="要求安全环境" checked={form.require_secure_env} onChange={(v) => setForm({ ...form, require_secure_env: v })} />
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
      </div>
    </Modal>
  );
}

// ==================== F12.2 水印溯源 ====================
function WatermarkTab({ canManage }: { canManage: boolean }) {
  const { items, loading, error, reload } = useList<Watermark>('/compliance/watermarks');
  const [showGen, setShowGen] = useState(false);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => setShowGen(true)}>
            <Droplet className="h-4 w-4" /> 生成水印
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">水印与溯源记录</div>
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-4 text-sm text-rose-600">{error}</div>
        ) : items.length === 0 ? (
          <Empty text="暂无水印记录" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><th className="th">目标</th><th className="th">水印文本</th><th className="th">溯源标识</th><th className="th">内容指纹</th><th className="th">创建人</th><th className="th">时间</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="td text-xs text-slate-600">{w.target_type}#{w.target_id}</td>
                    <td className="td max-w-[12rem] truncate text-slate-700">{w.text || '—'}</td>
                    <td className="td"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-indigo-700">{w.token}</code></td>
                    <td className="td"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{w.hash}</code></td>
                    <td className="td text-xs text-slate-500">{w.created_by}</td>
                    <td className="td whitespace-nowrap text-xs tabular-nums text-slate-400">{fmt(w.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showGen && <WatermarkModal onClose={() => setShowGen(false)} onSaved={reload} />}
    </div>
  );
}

function WatermarkModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ target_type: '', target_id: '', text: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Watermark | null>(null);
  const submit = async () => {
    setErr('');
    if (!form.target_type.trim() || !form.target_id.trim()) return setErr('请填写目标类型与目标 ID');
    setBusy(true);
    try {
      const wm = await fetchData<Watermark>('/compliance/watermark', { method: 'POST', body: form });
      setResult(wm);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="生成水印" onClose={onClose}>
      {result ? (
        <div className="space-y-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          <div>已生成水印并落库：</div>
          <div>溯源标识：<code className="rounded bg-white px-1.5 py-0.5 text-indigo-700">{result.token}</code></div>
          <div>内容指纹：<code className="rounded bg-white px-1.5 py-0.5 text-slate-600">{result.hash}</code></div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-secondary" onClick={() => { setResult(null); setForm({ target_type: '', target_id: '', text: '' }); }}>继续生成</button>
            <button className="btn-primary" onClick={onClose}>完成</button>
          </div>
        </div>
      ) : (
        <>
          <div><label className="label">目标类型 *</label><input className="input" placeholder="task / unit / export" value={form.target_type} onChange={(e) => setForm({ ...form, target_type: e.target.value })} /></div>
          <div><label className="label">目标 ID *</label><input className="input" value={form.target_id} onChange={(e) => setForm({ ...form, target_id: e.target.value })} /></div>
          <div><label className="label">水印文本</label><input className="input" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '生成中…' : '生成'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ==================== F12.3 环境隔离 ====================
function EnvironmentTab({ canManage }: { canManage: boolean }) {
  const { items, loading, error, reload } = useList<Environment>('/compliance/environments');
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Environment | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const remove = async (id: number) => {
    if (!window.confirm('确认删除？')) return;
    setBusy(id);
    try {
      await fetchData(`/compliance/environments/${id}`, { method: 'DELETE' });
      reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => { setEdit(null); setShow(true); }}>
            <Plus className="h-4 w-4" /> 新增环境
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-4 text-sm text-rose-600">{error}</div>
        ) : items.length === 0 ? (
          <Empty text="暂无安全环境" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr><th className="th">环境名称</th><th className="th">级别</th><th className="th">截屏</th><th className="th">复制</th><th className="th">需审批</th><th className="th">状态</th><th className="th">操作</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((env) => (
                <tr key={env.id} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-800">{env.name}</td>
                  <td className="td"><LevelBadge level={env.level} label={env.level_label} /></td>
                  <td className="td text-xs text-slate-500">{env.allow_screenshot ? '允许' : '禁止'}</td>
                  <td className="td text-xs text-slate-500">{env.allow_copy ? '允许' : '禁止'}</td>
                  <td className="td text-xs text-slate-500">{env.require_approval ? '是' : '否'}</td>
                  <td className="td"><span className={`badge ${env.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{env.enabled ? '启用' : '禁用'}</span></td>
                  <td className="td">
                    <RowActions canManage={canManage} id={env.id} busyId={busy} onEdit={() => { setEdit(env); setShow(true); }} onDelete={() => remove(env.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {show && <EnvironmentModal initial={edit} onClose={() => setShow(false)} onSaved={reload} />}
    </div>
  );
}

function EnvironmentModal({ initial, onClose, onSaved }: { initial: Environment | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    level: initial?.level || 'internal',
    allow_screenshot: initial?.allow_screenshot ?? false,
    allow_copy: initial?.allow_copy ?? false,
    require_approval: initial?.require_approval ?? true,
    enabled: initial?.enabled ?? true,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (!form.name.trim()) return setErr('请填写环境名称');
    setBusy(true);
    try {
      if (initial) await fetchData(`/compliance/environments/${initial.id}`, { method: 'PATCH', body: form });
      else await fetchData('/compliance/environments', { method: 'POST', body: form });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? '编辑环境' : '新增环境'} onClose={onClose}>
      <div><label className="label">环境名称 *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><label className="label">数据级别</label>
        <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
          {LEVEL_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-4">
        <Check label="允许截屏" checked={form.allow_screenshot} onChange={(v) => setForm({ ...form, allow_screenshot: v })} />
        <Check label="允许复制" checked={form.allow_copy} onChange={(v) => setForm({ ...form, allow_copy: v })} />
        <Check label="需审批" checked={form.require_approval} onChange={(v) => setForm({ ...form, require_approval: v })} />
        <Check label="启用" checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
      </div>
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
      </div>
    </Modal>
  );
}

// ==================== F12.4 操作审计 ====================
function AuditTab() {
  const { items, loading, error } = useList<AuditLog>('/compliance/audit-logs');
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">操作全审计</div>
      {loading ? (
        <Loading />
      ) : error ? (
        <div className="p-4 text-sm text-rose-600">{error}</div>
      ) : items.length === 0 ? (
        <Empty text="暂无审计日志" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr><th className="th">时间</th><th className="th">用户</th><th className="th">操作</th><th className="th">对象</th><th className="th">IP</th><th className="th">明细</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="td whitespace-nowrap text-xs tabular-nums text-slate-500">{fmt(l.created_at)}</td>
                  <td className="td text-xs text-slate-600">{l.user}</td>
                  <td className="td"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{l.action}</code></td>
                  <td className="td text-xs text-slate-500">{l.target_type}#{l.target_id}</td>
                  <td className="td text-xs text-slate-400">{l.ip || '—'}</td>
                  <td className="td max-w-md truncate text-xs text-slate-400">{JSON.stringify(l.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== F12.5 生命周期 ====================
function LifecycleTab({ canManage }: { canManage: boolean }) {
  const { items, loading, error, reload } = useList<LifecyclePolicy>('/compliance/lifecycle-policies');
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<LifecyclePolicy | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [applyTask, setApplyTask] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ total: number; results: any[] } | null>(null);
  const [applyErr, setApplyErr] = useState('');

  const remove = async (id: number) => {
    if (!window.confirm('确认删除？')) return;
    setBusy(id);
    try {
      await fetchData(`/compliance/lifecycle-policies/${id}`, { method: 'DELETE' });
      reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    setApplyErr('');
    setApplying(true);
    try {
      const body = applyTask.trim() ? { task_type: applyTask.trim() } : {};
      const res = await fetchData<{ total: number; results: any[] }>('/compliance/lifecycle/apply', { method: 'POST', body });
      setApplyResult(res);
    } catch (e: any) {
      setApplyErr(e.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input className="input w-56" placeholder="任务类型（留空=全部）" value={applyTask} onChange={(e) => setApplyTask(e.target.value)} />
            <button className="btn-secondary" onClick={apply} disabled={applying}>
              <Play className="h-4 w-4" /> {applying ? '执行中…' : '执行生命周期'}
            </button>
          </div>
          <button className="btn-primary" onClick={() => { setEdit(null); setShow(true); }}>
            <Plus className="h-4 w-4" /> 新增策略
          </button>
        </div>
      )}
      {applyErr && <div className="card p-3 text-sm text-rose-600">{applyErr}</div>}
      {applyResult && (
        <div className="card p-4 text-sm">
          <div className="font-medium text-slate-700">执行完成：共处理 {applyResult.total} 条</div>
          <div className="mt-2 space-y-1">
            {applyResult.results.length === 0 ? (
              <span className="text-slate-400">无启用策略</span>
            ) : (
              applyResult.results.map((r, i) => (
                <div key={i} className="text-xs text-slate-500">策略 #{r.policy_id}（{r.level}/{r.action}）处理 {r.processed} 条</div>
              ))
            )}
          </div>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-4 text-sm text-rose-600">{error}</div>
        ) : items.length === 0 ? (
          <Empty text="暂无生命周期策略" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr><th className="th">级别</th><th className="th">保留天数</th><th className="th">到期动作</th><th className="th">适用任务类型</th><th className="th">状态</th><th className="th">操作</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="td"><LevelBadge level={p.level} label={p.level_label} /></td>
                  <td className="td tabular-nums">{p.retention_days} 天</td>
                  <td className="td"><span className={`badge ${p.action === 'delete' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{p.action_label}</span></td>
                  <td className="td text-xs text-slate-600">{p.applies_to_task_type || '全部'}</td>
                  <td className="td"><span className={`badge ${p.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{p.enabled ? '启用' : '禁用'}</span></td>
                  <td className="td">
                    <RowActions canManage={canManage} id={p.id} busyId={busy} onEdit={() => { setEdit(p); setShow(true); }} onDelete={() => remove(p.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {show && <LifecycleModal initial={edit} onClose={() => setShow(false)} onSaved={reload} />}
    </div>
  );
}

function LifecycleModal({ initial, onClose, onSaved }: { initial: LifecyclePolicy | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    level: initial?.level || 'internal',
    retention_days: initial?.retention_days ?? 365,
    action: initial?.action || 'archive',
    applies_to_task_type: initial?.applies_to_task_type || '',
    enabled: initial?.enabled ?? true,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    const days = Number(form.retention_days);
    if (!days || days <= 0) return setErr('保留天数必须为正整数');
    setBusy(true);
    try {
      const body = { ...form, retention_days: days, applies_to_task_type: form.applies_to_task_type.trim() };
      if (initial) await fetchData(`/compliance/lifecycle-policies/${initial.id}`, { method: 'PATCH', body });
      else await fetchData('/compliance/lifecycle-policies', { method: 'POST', body });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? '编辑策略' : '新增策略'} onClose={onClose}>
      <div><label className="label">数据级别</label>
        <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
          {LEVEL_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div><label className="label">保留天数</label><input className="input" type="number" min={1} value={form.retention_days} onChange={(e) => setForm({ ...form, retention_days: Number(e.target.value) })} /></div>
      <div><label className="label">到期动作</label>
        <select className="input" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
          {ACTION_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div><label className="label">适用任务类型（留空=全部）</label><input className="input" value={form.applies_to_task_type} onChange={(e) => setForm({ ...form, applies_to_task_type: e.target.value })} /></div>
      <Check label="启用" checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
      </div>
    </Modal>
  );
}

// ==================== F12.6 合规检查 ====================
function ChecklistTab({ canManage }: { canManage: boolean }) {
  const checklists = useList<Checklist>('/compliance/checklists');
  const checks = useList<CheckResult>('/compliance/checks');
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Checklist | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [evaluating, setEvaluating] = useState<CheckResult | null>(null);

  const remove = async (id: number) => {
    if (!window.confirm('确认删除？')) return;
    setBusy(id);
    try {
      await fetchData(`/compliance/checklists/${id}`, { method: 'DELETE' });
      checklists.reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">合规检查清单</span>
          {canManage && (
            <button className="btn-secondary" onClick={() => { setEdit(null); setShow(true); }}>
              <Plus className="h-4 w-4" /> 新增检查项
            </button>
          )}
        </div>
        {checklists.loading ? (
          <Loading />
        ) : checklists.error ? (
          <div className="p-4 text-sm text-rose-600">{checklists.error}</div>
        ) : checklists.items.length === 0 ? (
          <Empty text="暂无检查项" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr><th className="th">框架</th><th className="th">检查项</th><th className="th">说明</th><th className="th">必需</th><th className="th">操作</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {checklists.items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="td"><span className="badge bg-indigo-50 text-indigo-600">{c.framework_label}</span></td>
                  <td className="td font-medium text-slate-800">{c.item}</td>
                  <td className="td max-w-[20rem] truncate text-xs text-slate-500">{c.description || '—'}</td>
                  <td className="td text-xs text-slate-500">{c.required ? '必需' : '可选'}</td>
                  <td className="td">
                    <RowActions canManage={canManage} id={c.id} busyId={busy} onEdit={() => { setEdit(c); setShow(true); }} onDelete={() => remove(c.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">检查结果</div>
        {checks.loading ? (
          <Loading />
        ) : checks.error ? (
          <div className="p-4 text-sm text-rose-600">{checks.error}</div>
        ) : checks.items.length === 0 ? (
          <Empty text="暂无检查结果" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr><th className="th">检查项</th><th className="th">框架</th><th className="th">状态</th><th className="th">评估人</th><th className="th">备注</th><th className="th">操作</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {checks.items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="td text-slate-700">{r.item}</td>
                  <td className="td text-xs text-slate-500">{r.framework}</td>
                  <td className="td"><CheckBadge status={r.status} label={r.status_label} /></td>
                  <td className="td text-xs text-slate-500">{r.checked_by || '—'}</td>
                  <td className="td max-w-[16rem] truncate text-xs text-slate-400">{r.note || '—'}</td>
                  <td className="td">
                    {canManage ? (
                      <button className="btn-secondary" onClick={() => setEvaluating(r)}>评估</button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {show && <ChecklistModal initial={edit} onClose={() => setShow(false)} onSaved={checklists.reload} />}
      {evaluating && <EvaluateModal check={evaluating} onClose={() => setEvaluating(null)} onSaved={checks.reload} />}
    </div>
  );
}

function CheckBadge({ status, label }: { status: string; label: string }) {
  const color =
    status === 'pass' ? 'bg-emerald-100 text-emerald-700' : status === 'fail' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';
  return <span className={`badge ${color}`}>{label}</span>;
}

function ChecklistModal({ initial, onClose, onSaved }: { initial: Checklist | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    framework: initial?.framework || 'other',
    item: initial?.item || '',
    description: initial?.description || '',
    required: initial?.required ?? true,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (!form.item.trim()) return setErr('请填写检查项');
    setBusy(true);
    try {
      if (initial) await fetchData(`/compliance/checklists/${initial.id}`, { method: 'PATCH', body: form });
      else await fetchData('/compliance/checklists', { method: 'POST', body: form });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? '编辑检查项' : '新增检查项'} onClose={onClose}>
      <div><label className="label">合规框架</label>
        <select className="input" value={form.framework} onChange={(e) => setForm({ ...form, framework: e.target.value })}>
          {FRAMEWORK_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div><label className="label">检查项 *</label><input className="input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} /></div>
      <div><label className="label">说明</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <Check label="必需项" checked={form.required} onChange={(v) => setForm({ ...form, required: v })} />
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
      </div>
    </Modal>
  );
}

function EvaluateModal({ check, onClose, onSaved }: { check: CheckResult; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(check.status || 'pending');
  const [note, setNote] = useState(check.note || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      await fetchData(`/compliance/checks/${check.id}/evaluate`, { method: 'POST', body: { status, note } });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="评估检查结果" onClose={onClose}>
      <div className="text-sm text-slate-600">{check.item}</div>
      <div><label className="label">评估状态</label>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pass">通过</option>
          <option value="fail">不通过</option>
          <option value="pending">待评估</option>
        </select>
      </div>
      <div><label className="label">备注</label><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '提交中…' : '提交'}</button>
      </div>
    </Modal>
  );
}
