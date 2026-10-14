import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2, Plug, RefreshCw, Send, Eye } from 'lucide-react';
import { fetchData, fetchList } from '../api';
import { useAuth } from '../auth';
import { Loading, Empty } from '../components/common';

// ---- 通用工具 ----
function fmt(dt?: string | null) {
  return dt ? dt.slice(0, 16).replace('T', ' ') : '—';
}

function parseJson(s: string): { ok: boolean; value: any; error?: string } {
  if (!s.trim()) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch (e: any) {
    return { ok: false, value: null, error: 'JSON 格式错误：' + e.message };
  }
}

const SOURCE_TYPE_OPTIONS: [string, string][] = [
  ['database', '数据库'],
  ['object_storage', '对象存储'],
  ['message_queue', '消息队列'],
  ['http_api', 'HTTP 接口'],
];

const PROVIDER_OPTIONS: [string, string][] = [
  ['oauth2', 'OAuth2'],
  ['saml', 'SAML'],
  ['oidc', 'OIDC'],
];

const DELIVERY_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  success: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
};

const DS_STATUS_COLOR: Record<string, string> = {
  unknown: 'bg-slate-100 text-slate-600',
  connected: 'bg-emerald-100 text-emerald-700',
  error: 'bg-rose-100 text-rose-700',
  disabled: 'bg-slate-200 text-slate-500',
};

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

function ErrorBanner({ text }: { text: string }) {
  if (!text) return null;
  return <div className="card p-3 text-sm text-rose-600">{text}</div>;
}

// ---- 类型 ----
interface APIClient {
  id: number; name: string; key: string; secret?: string; scopes: string[]; enabled: boolean;
  last_used_at: string | null; created_by: string; created_at: string;
}
interface Webhook {
  id: number; name: string; url: string; events: string[]; secret: string; enabled: boolean;
  created_by: string; created_at: string;
}
interface Delivery {
  id: number; webhook_id: number; event: string; payload: any; status: string; status_label: string;
  response_code: number | null; attempts: number; error: string; created_at: string;
}
interface DataSource {
  id: number; name: string; source_type: string; source_type_label: string; config: any; enabled: boolean;
  status: string; status_label: string; last_sync_at: string | null; created_by: string; created_at: string;
}
interface Platform {
  id: number; name: string; platform_type: string; endpoint: string; config: any; enabled: boolean;
  created_by: string; created_at: string;
}
interface SSOConfig {
  id: number; name: string; provider: string; provider_label: string; config: any; enabled: boolean;
  created_by: string; created_at: string;
}
interface SDKInfo {
  base_url: string; auth_type: string; auth_header: string; client_endpoint: string;
  openapi_schema: string; notes: string; open_api_auth_header: string; open_api_endpoints: string[];
}

const TABS: [string, string][] = [
  ['clients', '开放 API'],
  ['webhooks', 'Webhook'],
  ['datasources', '数据源'],
  ['platforms', '训练平台'],
  ['sso', 'SSO'],
  ['sdk', 'SDK/CLI'],
];

export default function Integration() {
  const { isRole } = useAuth();
  const canManage = isRole('admin', 'engineer');
  const canSecret = isRole('admin');
  const [tab, setTab] = useState('clients');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Plug className="h-5 w-5 text-indigo-600" /> 与业务系统集成
        </h1>
        <p className="text-sm text-slate-500">开放 API、Webhook、数据源、训练平台、SSO 与 SDK/CLI</p>
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
      {tab === 'clients' && <ClientsTab canManage={canManage} canSecret={canSecret} />}
      {tab === 'webhooks' && <WebhooksTab canManage={canManage} />}
      {tab === 'datasources' && <DataSourcesTab canManage={canManage} />}
      {tab === 'platforms' && <PlatformsTab canManage={canManage} />}
      {tab === 'sso' && <SSOTab canSecret={canSecret} />}
      {tab === 'sdk' && <SDKTab />}
    </div>
  );
}

// ==================== F13.1 开放 API ====================
function ClientsTab({ canManage, canSecret }: { canManage: boolean; canSecret: boolean }) {
  const { items, loading, error, reload } = useList<APIClient>('/integration/clients');
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<APIClient | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [credentials, setCredentials] = useState<{ key: string; secret: string; title: string } | null>(null);
  const [revealed, setRevealed] = useState<{ name: string; key: string; secret: string } | null>(null);
  const [actionErr, setActionErr] = useState('');

  const remove = async (id: number) => {
    if (!window.confirm('确认删除？')) return;
    setBusy(id);
    setActionErr('');
    try {
      await fetchData(`/integration/clients/${id}`, { method: 'DELETE' });
      reload();
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const rotate = async (c: APIClient) => {
    if (!window.confirm(`确认轮换「${c.name}」的密钥？旧密钥将立即失效。`)) return;
    setBusy(c.id);
    setActionErr('');
    try {
      const res = await fetchData<APIClient>(`/integration/clients/${c.id}/rotate`, { method: 'POST' });
      setCredentials({ key: res.key, secret: res.secret || '', title: `已轮换「${c.name}」` });
      reload();
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const reveal = async (c: APIClient) => {
    setActionErr('');
    try {
      const res = await fetchData<APIClient>(`/integration/clients/${c.id}`);
      setRevealed({ name: res.name, key: res.key, secret: res.secret || '' });
    } catch (e: any) {
      setActionErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => { setEdit(null); setShow(true); }}>
            <Plus className="h-4 w-4" /> 新增客户端
          </button>
        </div>
      )}
      <ErrorBanner text={actionErr} />
      {credentials && (
        <div className="card space-y-1 p-4 text-sm">
          <div className="font-medium text-emerald-700">{credentials.title}，请立即保存密钥（仅显示一次）：</div>
          <div>API Key：<code className="rounded bg-slate-100 px-1.5 py-0.5 text-indigo-700">{credentials.key}</code></div>
          <div>Secret：<code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{credentials.secret}</code></div>
          <div className="pt-1"><button className="btn-secondary" onClick={() => setCredentials(null)}>关闭</button></div>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-4 text-sm text-rose-600">{error}</div>
        ) : items.length === 0 ? (
          <Empty text="暂无开放 API 客户端" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><th className="th">名称</th><th className="th">Key</th><th className="th">授权范围</th><th className="th">状态</th><th className="th">最近使用</th><th className="th">操作</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-800">{c.name}</td>
                    <td className="td"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{c.key}</code></td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {c.scopes.length ? c.scopes.map((s) => <span key={s} className="badge bg-slate-100 text-slate-500">{s}</span>) : <span className="text-slate-300">—</span>}
                      </div>
                    </td>
                    <td className="td"><span className={`badge ${c.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{c.enabled ? '启用' : '禁用'}</span></td>
                    <td className="td whitespace-nowrap text-xs text-slate-400">{fmt(c.last_used_at)}</td>
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-1">
                        {canManage && <button className="btn-secondary" onClick={() => reveal(c)}><Eye className="h-4 w-4" /> 密钥</button>}
                        {canSecret && <button className="btn-secondary" onClick={() => rotate(c)} disabled={busy === c.id}><RefreshCw className="h-4 w-4" /> 轮换</button>}
                        <RowActions canManage={canManage} id={c.id} busyId={busy} onEdit={() => { setEdit(c); setShow(true); }} onDelete={() => remove(c.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {show && <ClientModal initial={edit} onClose={() => setShow(false)} onSaved={reload} onCreated={(c) => setCredentials({ key: c.key, secret: c.secret || '', title: `已创建「${c.name}」` })} />}
      {revealed && (
        <Modal title={`客户端密钥 · ${revealed.name}`} onClose={() => setRevealed(null)}>
          <div>API Key：<code className="rounded bg-slate-100 px-1.5 py-0.5 text-indigo-700">{revealed.key}</code></div>
          <div>Secret：<code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{revealed.secret}</code></div>
          <div className="flex justify-end"><button className="btn-primary" onClick={() => setRevealed(null)}>关闭</button></div>
        </Modal>
      )}
    </div>
  );
}

function ClientModal({
  initial,
  onClose,
  onSaved,
  onCreated,
}: {
  initial: APIClient | null;
  onClose: () => void;
  onSaved: () => void;
  onCreated: (c: APIClient) => void;
}) {
  const [form, setForm] = useState({ name: initial?.name || '', scopes: initial?.scopes?.join(',') || '', enabled: initial?.enabled ?? true });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (!form.name.trim()) return setErr('请填写客户端名称');
    setBusy(true);
    try {
      const body = { name: form.name.trim(), scopes: form.scopes.split(/[,，]/).map((s) => s.trim()).filter(Boolean), enabled: form.enabled };
      if (initial) {
        await fetchData(`/integration/clients/${initial.id}`, { method: 'PATCH', body });
        onSaved();
      } else {
        const created = await fetchData<APIClient>('/integration/clients', { method: 'POST', body });
        onSaved();
        onCreated(created);
      }
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? '编辑客户端' : '新增客户端'} onClose={onClose}>
      <div><label className="label">客户端名称 *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><label className="label">授权范围（逗号分隔）</label><input className="input" placeholder="tasks:read, units:write" value={form.scopes} onChange={(e) => setForm({ ...form, scopes: e.target.value })} /></div>
      <Check label="启用" checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
      {!initial && <p className="text-xs text-slate-400">Key / Secret 由服务端生成，创建后仅显示一次。</p>}
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
      </div>
    </Modal>
  );
}

// ==================== F13.2 Webhook ====================
function WebhooksTab({ canManage }: { canManage: boolean }) {
  const webhooks = useList<Webhook>('/integration/webhooks');
  const deliveries = useList<Delivery>('/integration/deliveries');
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Webhook | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ name: string; delivery: Delivery } | null>(null);
  const [actionErr, setActionErr] = useState('');

  const remove = async (id: number) => {
    if (!window.confirm('确认删除？')) return;
    setBusy(id);
    setActionErr('');
    try {
      await fetchData(`/integration/webhooks/${id}`, { method: 'DELETE' });
      webhooks.reload();
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const test = async (w: Webhook) => {
    setBusy(w.id);
    setActionErr('');
    setTestResult(null);
    try {
      const d = await fetchData<Delivery>(`/integration/webhooks/${w.id}/test`, { method: 'POST', body: { event: 'test' } });
      setTestResult({ name: w.name, delivery: d });
      deliveries.reload();
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      {canManage && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => { setEdit(null); setShow(true); }}>
            <Plus className="h-4 w-4" /> 新增 Webhook
          </button>
        </div>
      )}
      <ErrorBanner text={actionErr} />
      {testResult && (
        <div className={`card p-4 text-sm ${testResult.delivery.status === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
          <div className="font-medium">测试投递「{testResult.name}」：{testResult.delivery.status_label}</div>
          <div className="mt-1 text-xs">响应码：{testResult.delivery.response_code ?? '—'} · 尝试：{testResult.delivery.attempts} 次</div>
          {testResult.delivery.error && <div className="mt-1 text-xs">失败原因：{testResult.delivery.error}</div>}
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">Webhook 配置</div>
        {webhooks.loading ? (
          <Loading />
        ) : webhooks.error ? (
          <div className="p-4 text-sm text-rose-600">{webhooks.error}</div>
        ) : webhooks.items.length === 0 ? (
          <Empty text="暂无 Webhook" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><th className="th">名称</th><th className="th">回调地址</th><th className="th">订阅事件</th><th className="th">状态</th><th className="th">操作</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {webhooks.items.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-800">{w.name}</td>
                    <td className="td max-w-[18rem] truncate text-xs text-slate-500">{w.url}</td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {w.events.length ? w.events.map((ev) => <span key={ev} className="badge bg-slate-100 text-slate-500">{ev}</span>) : <span className="text-slate-300">—</span>}
                      </div>
                    </td>
                    <td className="td"><span className={`badge ${w.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{w.enabled ? '启用' : '禁用'}</span></td>
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-1">
                        {canManage && <button className="btn-secondary" onClick={() => test(w)} disabled={busy === w.id}><Send className="h-4 w-4" /> 测试</button>}
                        <RowActions canManage={canManage} id={w.id} busyId={busy} onEdit={() => { setEdit(w); setShow(true); }} onDelete={() => remove(w.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">投递记录</div>
        {deliveries.loading ? (
          <Loading />
        ) : deliveries.error ? (
          <div className="p-4 text-sm text-rose-600">{deliveries.error}</div>
        ) : deliveries.items.length === 0 ? (
          <Empty text="暂无投递记录" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><th className="th">事件</th><th className="th">Webhook</th><th className="th">状态</th><th className="th">响应码</th><th className="th">尝试</th><th className="th">失败原因</th><th className="th">时间</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.items.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="td text-slate-700">{d.event}</td>
                    <td className="td text-xs text-slate-500">#{d.webhook_id}</td>
                    <td className="td"><span className={`badge ${DELIVERY_COLOR[d.status] || 'bg-slate-100 text-slate-600'}`}>{d.status_label}</span></td>
                    <td className="td tabular-nums text-xs text-slate-600">{d.response_code ?? '—'}</td>
                    <td className="td tabular-nums text-xs text-slate-600">{d.attempts}</td>
                    <td className="td max-w-[16rem] truncate text-xs text-slate-400">{d.error || '—'}</td>
                    <td className="td whitespace-nowrap text-xs tabular-nums text-slate-400">{fmt(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {show && <WebhookModal initial={edit} onClose={() => setShow(false)} onSaved={webhooks.reload} />}
    </div>
  );
}

function WebhookModal({ initial, onClose, onSaved }: { initial: Webhook | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    url: initial?.url || '',
    events: initial?.events?.join(',') || '',
    secret: initial?.secret || '',
    enabled: initial?.enabled ?? true,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (!form.name.trim() || !form.url.trim()) return setErr('请填写名称与回调地址');
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        url: form.url.trim(),
        events: form.events.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        secret: form.secret,
        enabled: form.enabled,
      };
      if (initial) await fetchData(`/integration/webhooks/${initial.id}`, { method: 'PATCH', body });
      else await fetchData('/integration/webhooks', { method: 'POST', body });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? '编辑 Webhook' : '新增 Webhook'} onClose={onClose}>
      <div><label className="label">名称 *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><label className="label">回调地址 *</label><input className="input" placeholder="https://example.com/hook" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
      <div><label className="label">订阅事件（逗号分隔）</label><input className="input" value={form.events} onChange={(e) => setForm({ ...form, events: e.target.value })} /></div>
      <div><label className="label">签名密钥</label><input className="input" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} /></div>
      <Check label="启用" checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
      </div>
    </Modal>
  );
}

// ==================== F13.3 数据源 ====================
function DataSourcesTab({ canManage }: { canManage: boolean }) {
  const { items, loading, error, reload } = useList<DataSource>('/integration/datasources');
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<DataSource | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [result, setResult] = useState<{ id: number; kind: string; ok: boolean; message: string } | null>(null);
  const [actionErr, setActionErr] = useState('');

  const remove = async (id: number) => {
    if (!window.confirm('确认删除？')) return;
    setBusy(id);
    setActionErr('');
    try {
      await fetchData(`/integration/datasources/${id}`, { method: 'DELETE' });
      reload();
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const run = async (ds: DataSource, kind: 'test-connection' | 'sync') => {
    setBusy(ds.id);
    setActionErr('');
    setResult(null);
    try {
      if (kind === 'test-connection') {
        const r = await fetchData<{ ok: boolean; message: string }>(`/integration/datasources/${ds.id}/test-connection`, { method: 'POST' });
        setResult({ id: ds.id, kind: '连接校验', ok: r.ok, message: r.message });
      } else {
        const r = await fetchData<{ ok: boolean; synced: number; reason: string }>(`/integration/datasources/${ds.id}/sync`, { method: 'POST' });
        setResult({ id: ds.id, kind: '同步', ok: r.ok, message: `${r.reason}（同步 ${r.synced} 条）` });
      }
      reload();
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => { setEdit(null); setShow(true); }}>
            <Plus className="h-4 w-4" /> 新增数据源
          </button>
        </div>
      )}
      <ErrorBanner text={actionErr} />
      {result && (
        <div className={`card p-4 text-sm ${result.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          <div className="font-medium">数据源 #{result.id} {result.kind}：{result.ok ? '成功' : '失败'}</div>
          <div className="mt-1 text-xs">{result.message}</div>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-4 text-sm text-rose-600">{error}</div>
        ) : items.length === 0 ? (
          <Empty text="暂无数据源" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><th className="th">名称</th><th className="th">类型</th><th className="th">配置</th><th className="th">状态</th><th className="th">最近同步</th><th className="th">操作</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((ds) => (
                  <tr key={ds.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-800">{ds.name}</td>
                    <td className="td"><span className="badge bg-slate-100 text-slate-600">{ds.source_type_label}</span></td>
                    <td className="td max-w-[14rem] truncate text-xs text-slate-400">{JSON.stringify(ds.config)}</td>
                    <td className="td"><span className={`badge ${DS_STATUS_COLOR[ds.status] || 'bg-slate-100 text-slate-600'}`}>{ds.status_label}</span></td>
                    <td className="td whitespace-nowrap text-xs text-slate-400">{fmt(ds.last_sync_at)}</td>
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-1">
                        {canManage && (
                          <>
                            <button className="btn-secondary" onClick={() => run(ds, 'test-connection')} disabled={busy === ds.id}>校验</button>
                            <button className="btn-secondary" onClick={() => run(ds, 'sync')} disabled={busy === ds.id}>同步</button>
                          </>
                        )}
                        <RowActions canManage={canManage} id={ds.id} busyId={busy} onEdit={() => { setEdit(ds); setShow(true); }} onDelete={() => remove(ds.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {show && <DataSourceModal initial={edit} onClose={() => setShow(false)} onSaved={reload} />}
    </div>
  );
}

function DataSourceModal({ initial, onClose, onSaved }: { initial: DataSource | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    source_type: initial?.source_type || 'database',
    config: initial ? JSON.stringify(initial.config, null, 2) : '{\n  "host": "",\n  "database": ""\n}',
    enabled: initial?.enabled ?? true,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (!form.name.trim()) return setErr('请填写数据源名称');
    const parsed = parseJson(form.config);
    if (!parsed.ok) return setErr(parsed.error || '配置格式错误');
    setBusy(true);
    try {
      const body = { name: form.name.trim(), source_type: form.source_type, config: parsed.value, enabled: form.enabled };
      if (initial) await fetchData(`/integration/datasources/${initial.id}`, { method: 'PATCH', body });
      else await fetchData('/integration/datasources', { method: 'POST', body });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? '编辑数据源' : '新增数据源'} onClose={onClose}>
      <div><label className="label">名称 *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><label className="label">类型</label>
        <select className="input" value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>
          {SOURCE_TYPE_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div>
        <label className="label">连接配置（JSON）</label>
        <textarea className="input font-mono text-xs" rows={4} value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} />
        <p className="mt-1 text-xs text-slate-400">database 需 host/database；object_storage 需 endpoint/bucket；message_queue 需 brokers；http_api 需 url（可选 items_path/task_id/content_field 拉取后导入任务）。</p>
      </div>
      <Check label="启用" checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
      </div>
    </Modal>
  );
}

// ==================== F13.4 训练平台 ====================
function PlatformsTab({ canManage }: { canManage: boolean }) {
  const { items, loading, error, reload } = useList<Platform>('/integration/platforms');
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Platform | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [pushing, setPushing] = useState<Platform | null>(null);
  const [result, setResult] = useState<{ platform: string; status: string; statusLabel: string; response: any } | null>(null);
  const [actionErr, setActionErr] = useState('');

  const remove = async (id: number) => {
    if (!window.confirm('确认删除？')) return;
    setBusy(id);
    setActionErr('');
    try {
      await fetchData(`/integration/platforms/${id}`, { method: 'DELETE' });
      reload();
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => { setEdit(null); setShow(true); }}>
            <Plus className="h-4 w-4" /> 新增平台
          </button>
        </div>
      )}
      <ErrorBanner text={actionErr} />
      {result && (
        <div className={`card p-4 text-sm ${result.status === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
          <div className="font-medium">推送「{result.platform}」：{result.statusLabel}</div>
          <div className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-xs break-all">{JSON.stringify(result.response)}</div>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-4 text-sm text-rose-600">{error}</div>
        ) : items.length === 0 ? (
          <Empty text="暂无训练平台" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><th className="th">名称</th><th className="th">平台类型</th><th className="th">推送端点</th><th className="th">状态</th><th className="th">操作</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-800">{p.name}</td>
                    <td className="td text-xs text-slate-600">{p.platform_type}</td>
                    <td className="td max-w-[18rem] truncate text-xs text-slate-400">{p.endpoint || '—'}</td>
                    <td className="td"><span className={`badge ${p.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{p.enabled ? '启用' : '禁用'}</span></td>
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-1">
                        {canManage && <button className="btn-secondary" onClick={() => setPushing(p)}><Send className="h-4 w-4" /> 推送</button>}
                        <RowActions canManage={canManage} id={p.id} busyId={busy} onEdit={() => { setEdit(p); setShow(true); }} onDelete={() => remove(p.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {show && <PlatformModal initial={edit} onClose={() => setShow(false)} onSaved={reload} />}
      {pushing && (
        <PushModal
          platform={pushing}
          onClose={() => setPushing(null)}
          onDone={(rec) => setResult({ platform: pushing.name, status: rec.status, statusLabel: rec.status_label, response: rec.response })}
        />
      )}
    </div>
  );
}

function PlatformModal({ initial, onClose, onSaved }: { initial: Platform | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    platform_type: initial?.platform_type || '',
    endpoint: initial?.endpoint || '',
    config: initial ? JSON.stringify(initial.config, null, 2) : '{}',
    enabled: initial?.enabled ?? true,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (!form.name.trim()) return setErr('请填写平台名称');
    const parsed = parseJson(form.config);
    if (!parsed.ok) return setErr(parsed.error || '配置格式错误');
    setBusy(true);
    try {
      const body = { name: form.name.trim(), platform_type: form.platform_type.trim(), endpoint: form.endpoint.trim(), config: parsed.value, enabled: form.enabled };
      if (initial) await fetchData(`/integration/platforms/${initial.id}`, { method: 'PATCH', body });
      else await fetchData('/integration/platforms', { method: 'POST', body });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? '编辑平台' : '新增平台'} onClose={onClose}>
      <div><label className="label">名称 *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><label className="label">平台类型</label><input className="input" placeholder="mlflow / custom" value={form.platform_type} onChange={(e) => setForm({ ...form, platform_type: e.target.value })} /></div>
      <div><label className="label">推送端点</label><input className="input" placeholder="https://platform.example.com/push" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} /></div>
      <div><label className="label">配置（JSON）</label><textarea className="input font-mono text-xs" rows={3} value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} /></div>
      <Check label="启用" checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
      </div>
    </Modal>
  );
}

function PushModal({ platform, onClose, onDone }: { platform: Platform; onClose: () => void; onDone: (rec: { status: string; status_label: string; response: any }) => void }) {
  const [taskId, setTaskId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    const id = Number(taskId);
    if (!id) return setErr('请输入任务 ID');
    setBusy(true);
    try {
      const rec = await fetchData<{ status: string; status_label: string; response: any }>(`/integration/platforms/${platform.id}/push`, { method: 'POST', body: { task: id } });
      onDone(rec);
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`推送结果 · ${platform.name}`} onClose={onClose}>
      <div className="text-xs text-slate-500">将任务下已人工审核的结果推送到训练平台。</div>
      <div><label className="label">任务 ID *</label><input className="input" type="number" value={taskId} onChange={(e) => setTaskId(e.target.value)} /></div>
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '推送中…' : '推送'}</button>
      </div>
    </Modal>
  );
}

// ==================== F13.5 SSO ====================
function SSOTab({ canSecret }: { canSecret: boolean }) {
  const { items, loading, error, reload } = useList<SSOConfig>('/integration/sso-configs');
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<SSOConfig | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [actionErr, setActionErr] = useState('');

  const remove = async (id: number) => {
    if (!window.confirm('确认删除？')) return;
    setBusy(id);
    setActionErr('');
    try {
      await fetchData(`/integration/sso-configs/${id}`, { method: 'DELETE' });
      reload();
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {canSecret ? (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => { setEdit(null); setShow(true); }}>
            <Plus className="h-4 w-4" /> 新增 SSO 配置
          </button>
        </div>
      ) : (
        <div className="text-xs text-slate-400">SSO 配置仅管理员可维护。</div>
      )}
      <ErrorBanner text={actionErr} />
      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-4 text-sm text-rose-600">{error}</div>
        ) : items.length === 0 ? (
          <Empty text="暂无 SSO 配置" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><th className="th">名称</th><th className="th">协议</th><th className="th">配置</th><th className="th">状态</th><th className="th">操作</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-800">{s.name}</td>
                    <td className="td"><span className="badge bg-indigo-50 text-indigo-600">{s.provider_label}</span></td>
                    <td className="td max-w-[18rem] truncate text-xs text-slate-400">{JSON.stringify(s.config)}</td>
                    <td className="td"><span className={`badge ${s.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{s.enabled ? '启用' : '禁用'}</span></td>
                    <td className="td">
                      <RowActions canManage={canSecret} id={s.id} busyId={busy} onEdit={() => { setEdit(s); setShow(true); }} onDelete={() => remove(s.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {show && <SSOModal initial={edit} onClose={() => setShow(false)} onSaved={reload} />}
    </div>
  );
}

function SSOModal({ initial, onClose, onSaved }: { initial: SSOConfig | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    provider: initial?.provider || 'oauth2',
    config: initial ? JSON.stringify(initial.config, null, 2) : '{}',
    enabled: initial?.enabled ?? true,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (!form.name.trim()) return setErr('请填写名称');
    const parsed = parseJson(form.config);
    if (!parsed.ok) return setErr(parsed.error || '配置格式错误');
    setBusy(true);
    try {
      const body = { name: form.name.trim(), provider: form.provider, config: parsed.value, enabled: form.enabled };
      if (initial) await fetchData(`/integration/sso-configs/${initial.id}`, { method: 'PATCH', body });
      else await fetchData('/integration/sso-configs', { method: 'POST', body });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={initial ? '编辑 SSO 配置' : '新增 SSO 配置'} onClose={onClose}>
      <div><label className="label">名称 *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><label className="label">协议</label>
        <select className="input" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
          {PROVIDER_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div><label className="label">配置（JSON）</label><textarea className="input font-mono text-xs" rows={3} value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} /></div>
      <Check label="启用" checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
      {err && <div className="text-sm text-rose-600">{err}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
      </div>
    </Modal>
  );
}

// ==================== F13.6 SDK/CLI ====================
function SDKTab() {
  const [info, setInfo] = useState<SDKInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    setLoading(true);
    fetchData<SDKInfo>('/integration/sdk-info')
      .then(setInfo)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card"><Loading /></div>;
  if (error) return <div className="card p-4 text-sm text-rose-600">{error}</div>;
  if (!info) return <Empty text="暂无 SDK 信息" />;

  const rows: [string, string][] = [
    ['Base URL', info.base_url],
    ['鉴权方式', info.auth_type],
    ['鉴权 Header', info.auth_header],
    ['开放 API 鉴权', info.open_api_auth_header],
    ['客户端接口', info.client_endpoint],
    ['OpenAPI Schema', info.openapi_schema],
  ];
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">SDK / CLI 调用说明</div>
      <div className="divide-y divide-slate-100">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center gap-4 px-4 py-3 text-sm">
            <span className="w-32 flex-none text-slate-500">{k}</span>
            <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{v}</code>
          </div>
        ))}
      </div>
      {info.open_api_endpoints?.length > 0 && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {info.open_api_endpoints.map((ep) => (
            <div key={ep} className="px-4 py-2 text-xs text-slate-600">
              <code className="rounded bg-slate-100 px-2 py-0.5">{ep}</code>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">{info.notes}</div>
    </div>
  );
}
