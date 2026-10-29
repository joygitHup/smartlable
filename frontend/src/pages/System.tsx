import { useEffect, useState } from 'react';
import { Plus, X, ScrollText } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Loading, Empty, toast } from '../components/common';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理员',
  operator: '标注运营',
  annotator: '标注员',
  engineer: '算法工程师',
  pm: '项目经理',
};

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-rose-50 text-rose-600',
  operator: 'bg-indigo-50 text-indigo-600',
  annotator: 'bg-emerald-50 text-emerald-600',
  engineer: 'bg-cyan-50 text-cyan-600',
  pm: 'bg-amber-50 text-amber-600',
};

export default function System() {
  const { hasPerm } = useAuth();
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">系统管理</h1>
        <p className="text-sm text-slate-500">用户与权限、操作审计</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            ['users', '用户管理'],
            ['audit', '操作日志'],
          ] as ['users' | 'audit', string][]
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
      {tab === 'users' ? <UsersTab canManage={hasPerm('user:manage')} /> : <AuditTab />}
    </div>
  );
}

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: string;
  role_label: string;
  skills: string[];
  max_load: number;
  is_active: boolean;
  date_joined: string;
}

function UsersTab({ canManage }: { canManage: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    api<UserRow[]>('/users')
      .then(setUsers)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 新增用户
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : users.length === 0 ? (
          <Empty text="暂无用户" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr><th className="th">用户名</th><th className="th">角色</th><th className="th">技能</th><th className="th">最大负载</th><th className="th">状态</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="td">
                    <div className="font-medium text-slate-800">{u.display_name}</div>
                    <div className="text-xs text-slate-400">@{u.username}</div>
                  </td>
                  <td className="td"><span className={`badge ${ROLE_COLOR[u.role] || 'bg-slate-100 text-slate-600'}`}>{u.role_label}</span></td>
                  <td className="td">
                    {u.skills?.length ? (
                      <div className="flex flex-wrap gap-1">{u.skills.map((s) => <span key={s} className="badge bg-slate-100 text-slate-500">{s}</span>)}</div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="td tabular-nums">{u.max_load || '—'}</td>
                  <td className="td">
                    <span className={`badge ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                      {u.is_active ? '启用' : '禁用'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ username: '', display_name: '', password: 'annotate123', role: 'annotator', skills: '', max_load: 0 });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (!form.username.trim()) return setErr('请填写用户名');
    setBusy(true);
    try {
      await api('/users', {
        method: 'POST',
        body: { ...form, skills: form.skills.split(/[,，]/).map((s) => s.trim()).filter(Boolean), max_load: Number(form.max_load) },
      });
      toast.success(`用户「${form.username.trim()}」已创建`);
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
          <h2 className="text-lg font-semibold">新增用户</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">用户名 *</label><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div><label className="label">显示名</label><input className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
          </div>
          <div><label className="label">角色</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">技能（逗号分隔）</label><input className="input" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} /></div>
            <div><label className="label">最大负载</label><input className="input" type="number" value={form.max_load} onChange={(e) => setForm({ ...form, max_load: Number(e.target.value) })} /></div>
          </div>
          <div><label className="label">初始密码</label><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '创建中…' : '创建'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<any[]>('/audit-logs')
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
        <ScrollText className="h-4 w-4 text-slate-400" /> 最近 200 条关键操作
      </div>
      {loading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <Empty text="暂无操作日志" />
      ) : (
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr><th className="th">时间</th><th className="th">用户</th><th className="th">操作</th><th className="th">对象</th><th className="th">明细</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="td whitespace-nowrap tabular-nums text-xs text-slate-500">{l.created_at.slice(0, 16).replace('T', ' ')}</td>
                <td className="td">{l.user}</td>
                <td className="td"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{l.action}</code></td>
                <td className="td text-xs text-slate-500">{l.target_type}#{l.target_id}</td>
                <td className="td max-w-md truncate text-xs text-slate-400">{JSON.stringify(l.detail)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}