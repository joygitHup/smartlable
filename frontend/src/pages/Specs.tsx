import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  X,
  RefreshCw,
  Sparkles,
  GitCompare,
  Send,
  Save,
  Gavel,
  CheckCircle2,
  XCircle,
  BookOpen,
  Hammer,
} from 'lucide-react';
import { api, fetchData, fetchList } from '../api';
import { useAuth } from '../auth';
import { Loading, Empty, toast } from '../components/common';

// ---- 公共常量与工具 ----

const TASK_TYPES: [string, string][] = [
  ['classification', '文本分类'],
  ['sentiment', '情感分析'],
  ['entity', '实体抽取'],
  ['object_detection', '目标检测'],
];

const SPEC_STATUSES: [string, string][] = [
  ['draft', '草稿'],
  ['published', '已发布'],
  ['archived', '已归档'],
];

const DISPUTE_STATUSES: [string, string][] = [
  ['open', '待认领'],
  ['claimed', '已认领'],
  ['resolved', '已裁决'],
];

const SPEC_STATUS_CLS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-slate-200 text-slate-500',
};

const DISPUTE_STATUS_CLS: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  claimed: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
};

function typeLabel(t: string): string {
  return TASK_TYPES.find(([k]) => k === t)?.[1] || t;
}

function formatTime(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
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

function parseJson(text: string): any {
  const t = text.trim();
  if (!t) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

// ---- 类型 ----

interface SpecVersion {
  id: number;
  version: number;
  content: string;
  change_note: string;
  status: string;
  created_by: string;
  created_at: string;
}

interface SpecDoc {
  id: number;
  title: string;
  task_type: string;
  task_type_label: string;
  content: string;
  status: string;
  status_label: string;
  current_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  task_id?: number | null;
  versions?: SpecVersion[];
}

interface Arbitration {
  id: number;
  decision: string;
  label: any;
  note: string;
  arbiter: string;
  created_at: string;
  dispute_status?: string;
}

interface Dispute {
  id: number;
  task_id: number;
  unit_id: number | null;
  raised_by: string;
  reason: string;
  status: string;
  status_label: string;
  created_at: string;
  claimed_by?: string;
  arbitration?: Arbitration | null;
}

interface Quiz {
  id: number;
  title: string;
  task_type: string;
  task_type_label: string;
  question: string;
  options: any[];
  answer: any;
  difficulty: string;
  difficulty_label: string;
  reference: string;
  created_at: string;
}

interface Attempt {
  id: number;
  quiz_id: number;
  trainee: string;
  answer: any;
  passed: boolean;
  score: number;
  created_at: string;
}

interface ImpactResult {
  spec_id: number;
  from_version: number;
  to_version: number;
  changed: boolean;
  diff: { added: number; removed: number; added_lines: string[]; removed_lines: string[] };
  total_units: number;
  affected_units: number;
  requires_relabel: boolean;
  reason?: string;
  rework_created?: number;
  rework_skipped?: number;
}

interface DraftResult {
  spec_id: number;
  task_type: string;
  draft: string;
  raw: any;
}

// ---- 页面 ----

type Tab = 'docs' | 'disputes' | 'training';

export default function Specs() {
  const { isRole } = useAuth();
  const [tab, setTab] = useState<Tab>('docs');
  const canManage = isRole('admin', 'operator', 'pm');
  const canPublish = isRole('admin', 'engineer', 'pm');
  const canArbitrate = isRole('admin', 'engineer', 'operator');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">标注规范与冷启动</h1>
        <p className="text-sm text-slate-500">规范版本管理、争议仲裁与标注员培训考核</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            ['docs', '规范文档'],
            ['disputes', '争议仲裁'],
            ['training', '培训模式'],
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
      {tab === 'docs' && <DocsTab canManage={canManage} canPublish={canPublish} />}
      {tab === 'disputes' && <DisputesTab canManage={canManage} canArbitrate={canArbitrate} />}
      {tab === 'training' && <TrainingTab />}
    </div>
  );
}

// ---- Tab1：规范文档 ----

function DocsTab({ canManage, canPublish }: { canManage: boolean; canPublish: boolean }) {
  const [docs, setDocs] = useState<SpecDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fTaskType, setFTaskType] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fQ, setFQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<SpecDoc>(`/specs${qs({ task_type: fTaskType, status: fStatus, q: fQ, pageSize: 50 })}`)
      .then((r) => {
        setDocs(r.list);
        setTotal(r.total);
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [fTaskType, fStatus, fQ]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">任务类型</label>
          <select className="input" value={fTaskType} onChange={(e) => setFTaskType(e.target.value)}>
            <option value="">全部</option>
            {TASK_TYPES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">状态</label>
          <select className="input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">全部</option>
            {SPEC_STATUSES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[12rem] flex-1">
          <label className="label">搜索标题</label>
          <input className="input" value={fQ} onChange={(e) => setFQ(e.target.value)} placeholder="按标题模糊搜索" />
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 新建规范
          </button>
        )}
      </div>

      {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          共 <span className="font-medium tabular-nums">{total}</span> 份规范
        </div>
        {loading ? (
          <Loading />
        ) : docs.length === 0 ? (
          <Empty text="暂无规范文档" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">标题</th>
                <th className="th">任务类型</th>
                <th className="th">状态</th>
                <th className="th">当前版本</th>
                <th className="th">创建人</th>
                <th className="th">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((d) => (
                <tr key={d.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetailId(d.id)}>
                  <td className="td font-medium text-slate-800">{d.title}</td>
                  <td className="td">
                    <Pill cls="bg-slate-100 text-slate-600">{d.task_type_label || typeLabel(d.task_type)}</Pill>
                  </td>
                  <td className="td">
                    <Pill cls={SPEC_STATUS_CLS[d.status] || 'bg-slate-100 text-slate-600'}>
                      {d.status_label || d.status}
                    </Pill>
                  </td>
                  <td className="td tabular-nums">{d.current_version ? `v${d.current_version}` : '—'}</td>
                  <td className="td text-slate-500">{d.created_by || '—'}</td>
                  <td className="td whitespace-nowrap text-xs text-slate-400">{formatTime(d.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateSpecModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {detailId !== null && (
        <SpecDetailModal id={detailId} canPublish={canPublish} onClose={() => setDetailId(null)} onChanged={load} />
      )}
    </div>
  );
}

function CreateSpecModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', task_type: 'classification', task: '', content: '', status: 'draft' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!form.title.trim()) return setErr('请填写规范标题');
    setBusy(true);
    try {
      const body: any = {
        title: form.title.trim(),
        task_type: form.task_type,
        content: form.content,
        status: form.status,
      };
      if (form.task.trim()) body.task = Number(form.task);
      await fetchData('/specs', { method: 'POST', body });
      toast.success('规范已创建');
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
          <h2 className="text-lg font-semibold">新建标注规范</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">标题 *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">任务类型</label>
              <select
                className="input"
                value={form.task_type}
                onChange={(e) => setForm({ ...form, task_type: e.target.value })}
              >
                {TASK_TYPES.map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">关联任务 ID（可选）</label>
              <input
                className="input"
                type="number"
                value={form.task}
                onChange={(e) => setForm({ ...form, task: e.target.value })}
                placeholder="用于按任务生成初稿/影响分析"
              />
            </div>
          </div>
          <div>
            <label className="label">规范正文</label>
            <textarea
              className="input h-32"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>
          <div>
            <label className="label">状态</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {SPEC_STATUSES.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button className="btn-primary" onClick={submit} disabled={busy}>
              {busy ? '创建中…' : '创建'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecDetailModal({
  id,
  canPublish,
  onClose,
  onChanged,
}: {
  id: number;
  canPublish: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [spec, setSpec] = useState<SpecDoc | null>(null);
  const [versions, setVersions] = useState<SpecVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [verForm, setVerForm] = useState({ version: '', content: '', change_note: '' });
  const [publishVersion, setPublishVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [impactFrom, setImpactFrom] = useState('');
  const [impactTo, setImpactTo] = useState('');
  const [reworkMsg, setReworkMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchData<SpecDoc>(`/specs/${id}`)
      .then((d) => {
        setSpec(d);
        setVersions(d.versions || []);
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const reloadVersions = async () => {
    try {
      const list = await fetchData<SpecVersion[]>(`/specs/${id}/versions`);
      setVersions(list || []);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const createVersion = async () => {
    setErr('');
    setMsg('');
    const v = Number(verForm.version);
    if (!v) return setErr('请填写版本号');
    setBusy(true);
    try {
      await fetchData(`/specs/${id}/versions`, {
        method: 'POST',
        body: { version: v, content: verForm.content, change_note: verForm.change_note },
      });
      setVerForm({ version: '', content: '', change_note: '' });
      setMsg('版本已创建');
      toast.success('版本已创建');
      await reloadVersions();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setErr('');
    setMsg('');
    const v = Number(publishVersion);
    if (!v) return setErr('请填写要发布的版本号');
    setBusy(true);
    try {
      const res = await fetchData<{ current_version: number; status: string }>(`/specs/${id}/publish`, {
        method: 'POST',
        body: { version: v },
      });
      setMsg(`已发布 v${res.current_version}（${res.status}）`);
      toast.success(`已发布 v${res.current_version}`);
      setPublishVersion('');
      await load();
      onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const generateDraft = async () => {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const res = await fetchData<DraftResult>(`/specs/${id}/generate-draft`, { method: 'POST' });
      setDraft(res);
      toast.success('初稿已生成');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runImpact = async () => {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const res = await fetchData<ImpactResult>(
        `/specs/${id}/impact${qs({ from: impactFrom, to: impactTo })}`
      );
      setImpact(res);
      setReworkMsg('');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runRelabel = async () => {
    setErr('');
    setMsg('');
    setReworkMsg('');
    setBusy(true);
    try {
      const res = await fetchData<ImpactResult>(`/specs/${id}/relabel-impact`, {
        method: 'POST',
        body: {
          from: impactFrom ? Number(impactFrom) : undefined,
          to: impactTo ? Number(impactTo) : undefined,
        },
      });
      setImpact(res);
      setReworkMsg(`已生成返工任务 ${res.rework_created ?? 0} 条，跳过 ${res.rework_skipped ?? 0} 条`);
      toast.success(`已生成返工任务 ${res.rework_created ?? 0} 条`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">{spec?.title || `规范 #${id}`}</h2>
            {spec && (
              <Pill cls={SPEC_STATUS_CLS[spec.status] || 'bg-slate-100 text-slate-600'}>
                {spec.status_label || spec.status}
              </Pill>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <Loading />
        ) : err ? (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>
        ) : !spec ? (
          <Empty text="规范不存在" />
        ) : (
          <div className="space-y-5">
            {msg && <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              <div>
                <div className="text-xs text-slate-400">任务类型</div>
                <div className="font-medium text-slate-700">{spec.task_type_label || typeLabel(spec.task_type)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">当前版本</div>
                <div className="font-medium text-slate-700 tabular-nums">
                  {spec.current_version ? `v${spec.current_version}` : '未发布'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">关联任务</div>
                <div className="font-medium text-slate-700">{spec.task_id ? `#${spec.task_id}` : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">创建人</div>
                <div className="font-medium text-slate-700">{spec.created_by || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">更新时间</div>
                <div className="font-medium text-slate-700">{formatTime(spec.updated_at)}</div>
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs text-slate-400">当前正文</div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                {spec.content || '（空）'}
              </pre>
            </div>

            {/* 版本列表 */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-700">版本历史</h3>
                <button className="btn-secondary" onClick={reloadVersions}>
                  <RefreshCw className="h-3.5 w-3.5" /> 刷新版本
                </button>
              </div>
              {versions.length === 0 ? (
                <Empty text="暂无版本记录" />
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="th">版本</th>
                        <th className="th">状态</th>
                        <th className="th">变更说明</th>
                        <th className="th">创建人</th>
                        <th className="th">时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {versions.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="td tabular-nums font-medium">v{v.version}</td>
                          <td className="td">
                            <Pill cls={SPEC_STATUS_CLS[v.status] || 'bg-slate-100 text-slate-600'}>
                              {SPEC_STATUSES.find(([k]) => k === v.status)?.[1] || v.status}
                            </Pill>
                          </td>
                          <td className="td text-slate-500">{v.change_note || '—'}</td>
                          <td className="td text-slate-500">{v.created_by || '—'}</td>
                          <td className="td whitespace-nowrap text-xs text-slate-400">{formatTime(v.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {canPublish && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* 新建版本 */}
                <div className="card p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Save className="h-4 w-4 text-slate-400" /> 新建版本
                  </h3>
                  <div className="space-y-2">
                    <input
                      className="input"
                      type="number"
                      placeholder="版本号（正整数）"
                      value={verForm.version}
                      onChange={(e) => setVerForm({ ...verForm, version: e.target.value })}
                    />
                    <textarea
                      className="input h-24"
                      placeholder="版本正文"
                      value={verForm.content}
                      onChange={(e) => setVerForm({ ...verForm, content: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="变更说明"
                      value={verForm.change_note}
                      onChange={(e) => setVerForm({ ...verForm, change_note: e.target.value })}
                    />
                    <button className="btn-primary w-full" onClick={createVersion} disabled={busy}>
                      创建版本
                    </button>
                  </div>
                </div>

                {/* 发布 */}
                <div className="card p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Send className="h-4 w-4 text-slate-400" /> 发布版本
                  </h3>
                  <p className="mb-2 text-xs text-slate-500">发布后该版本生效，其它已发布版本自动归档。</p>
                  <div className="flex gap-2">
                    <input
                      className="input"
                      type="number"
                      placeholder="版本号"
                      value={publishVersion}
                      onChange={(e) => setPublishVersion(e.target.value)}
                    />
                    <button className="btn-primary flex-none" onClick={publish} disabled={busy}>
                      发布
                    </button>
                  </div>
                </div>

                {/* LLM 初稿 */}
                <div className="card p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Sparkles className="h-4 w-4 text-slate-400" /> AI 生成规范初稿
                  </h3>
                  <button className="btn-secondary" onClick={generateDraft} disabled={busy}>
                    <Sparkles className="h-4 w-4" /> 生成初稿
                  </button>
                  {draft && (
                    <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                      {draft.draft}
                    </pre>
                  )}
                </div>

                {/* 影响分析 */}
                <div className="card p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <GitCompare className="h-4 w-4 text-slate-400" /> 变更影响分析
                  </h3>
                  <div className="mb-2 flex gap-2">
                    <input
                      className="input"
                      type="number"
                      placeholder="起始版本"
                      value={impactFrom}
                      onChange={(e) => setImpactFrom(e.target.value)}
                    />
                    <input
                      className="input"
                      type="number"
                      placeholder="目标版本"
                      value={impactTo}
                      onChange={(e) => setImpactTo(e.target.value)}
                    />
                    <button className="btn-secondary flex-none" onClick={runImpact} disabled={busy}>
                      分析
                    </button>
                  </div>
                  <button className="btn-primary mb-2 w-full" onClick={runRelabel} disabled={busy}>
                    <Hammer className="h-4 w-4" /> 生成返工任务
                  </button>
                  {reworkMsg && <div className="mb-2 text-xs text-emerald-600">{reworkMsg}</div>}
                  {impact && (
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex flex-wrap gap-3">
                        <span>
                          v{impact.from_version} → v{impact.to_version}
                        </span>
                        <span className="text-emerald-600">+{impact.diff.added} 行</span>
                        <span className="text-rose-600">-{impact.diff.removed} 行</span>
                      </div>
                      <div>
                        影响样本：共 <span className="font-medium tabular-nums">{impact.total_units}</span> 条，其中已人工审核{' '}
                        <span className="font-medium tabular-nums">{impact.affected_units}</span> 条
                        {impact.requires_relabel && (
                          <span className="ml-2 badge bg-amber-100 text-amber-700">需重标</span>
                        )}
                      </div>
                      {impact.diff.added_lines.length > 0 && (
                        <div>
                          <div className="text-xs text-slate-400">新增行</div>
                          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-emerald-50 p-2 text-xs text-emerald-700">
                            {impact.diff.added_lines.join('\n')}
                          </pre>
                        </div>
                      )}
                      {impact.diff.removed_lines.length > 0 && (
                        <div>
                          <div className="text-xs text-slate-400">删除行</div>
                          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-rose-50 p-2 text-xs text-rose-700">
                            {impact.diff.removed_lines.join('\n')}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Tab2：争议仲裁 ----

function DisputesTab({ canManage, canArbitrate }: { canManage: boolean; canArbitrate: boolean }) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fTask, setFTask] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<Dispute>(`/disputes${qs({ task: fTask, status: fStatus, pageSize: 50 })}`)
      .then((r) => {
        setDisputes(r.list);
        setTotal(r.total);
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [fTask, fStatus]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">任务 ID</label>
          <input className="input" type="number" value={fTask} onChange={(e) => setFTask(e.target.value)} placeholder="按任务过滤" />
        </div>
        <div>
          <label className="label">状态</label>
          <select className="input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">全部</option>
            {DISPUTE_STATUSES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 发起争议
          </button>
        )}
      </div>

      {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          共 <span className="font-medium tabular-nums">{total}</span> 条争议
        </div>
        {loading ? (
          <Loading />
        ) : disputes.length === 0 ? (
          <Empty text="暂无争议样本" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">ID</th>
                <th className="th">任务</th>
                <th className="th">样本</th>
                <th className="th">发起人</th>
                <th className="th">争议原因</th>
                <th className="th">状态</th>
                <th className="th">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {disputes.map((d) => (
                <tr key={d.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetailId(d.id)}>
                  <td className="td tabular-nums text-slate-400">#{d.id}</td>
                  <td className="td">#{d.task_id}</td>
                  <td className="td text-slate-500">{d.unit_id ? `#${d.unit_id}` : '—'}</td>
                  <td className="td text-slate-500">{d.raised_by || '—'}</td>
                  <td className="td max-w-xs truncate">{d.reason || '—'}</td>
                  <td className="td">
                    <Pill cls={DISPUTE_STATUS_CLS[d.status] || 'bg-slate-100 text-slate-600'}>
                      {d.status_label || d.status}
                    </Pill>
                  </td>
                  <td className="td whitespace-nowrap text-xs text-slate-400">{formatTime(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateDisputeModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {detailId !== null && (
        <DisputeDetailModal
          id={detailId}
          canArbitrate={canArbitrate}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function CreateDisputeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ task: '', unit: '', reason: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!form.task.trim()) return setErr('请填写任务 ID');
    setBusy(true);
    try {
      const body: any = { task: Number(form.task), reason: form.reason };
      if (form.unit.trim()) body.unit = Number(form.unit);
      await fetchData('/disputes', { method: 'POST', body });
      toast.success('争议已提交');
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
          <h2 className="text-lg font-semibold">发起争议样本</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">任务 ID *</label>
              <input className="input" type="number" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} />
            </div>
            <div>
              <label className="label">样本 ID（可选）</label>
              <input className="input" type="number" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">争议原因</label>
            <textarea className="input h-28" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button className="btn-primary" onClick={submit} disabled={busy}>
              {busy ? '提交中…' : '提交'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DisputeDetailModal({
  id,
  canArbitrate,
  onClose,
  onChanged,
}: {
  id: number;
  canArbitrate: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [arbForm, setArbForm] = useState({ decision: '', label: '', note: '' });

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchData<Dispute>(`/disputes/${id}`)
      .then(setDispute)
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async () => {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      await fetchData(`/disputes/${id}/claim`, { method: 'POST' });
      setMsg('已认领');
      toast.success('已认领');
      await load();
      onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const arbitrate = async () => {
    setErr('');
    setMsg('');
    if (!arbForm.decision.trim()) return setErr('请填写裁决结论');
    setBusy(true);
    try {
      const res = await fetchData<Arbitration>(`/disputes/${id}/arbitrate`, {
        method: 'POST',
        body: { decision: arbForm.decision.trim(), label: parseJson(arbForm.label), note: arbForm.note },
      });
      setMsg(`已裁决：${res.decision}`);
      toast.success('已裁决');
      setArbForm({ decision: '', label: '', note: '' });
      await load();
      onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">争议 #{id}</h2>
            {dispute && (
              <Pill cls={DISPUTE_STATUS_CLS[dispute.status] || 'bg-slate-100 text-slate-600'}>
                {dispute.status_label || dispute.status}
              </Pill>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <Loading />
        ) : err ? (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>
        ) : !dispute ? (
          <Empty text="争议不存在" />
        ) : (
          <div className="space-y-4">
            {msg && <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <div className="text-xs text-slate-400">任务</div>
                <div className="font-medium text-slate-700">#{dispute.task_id}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">样本</div>
                <div className="font-medium text-slate-700">{dispute.unit_id ? `#${dispute.unit_id}` : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">发起人</div>
                <div className="font-medium text-slate-700">{dispute.raised_by || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">认领人</div>
                <div className="font-medium text-slate-700">{dispute.claimed_by || '—'}</div>
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs text-slate-400">争议原因</div>
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">{dispute.reason || '（空）'}</p>
            </div>

            {dispute.arbitration ? (
              <div className="card p-4">
                <h3 className="mb-2 text-sm font-medium text-slate-700">裁决结果</h3>
                <div className="space-y-1 text-sm text-slate-600">
                  <div>结论：<span className="font-medium text-slate-800">{dispute.arbitration.decision}</span></div>
                  <div>裁决人：{dispute.arbitration.arbiter || '—'}</div>
                  <div>标签：{dispute.arbitration.label != null ? JSON.stringify(dispute.arbitration.label) : '—'}</div>
                  <div>说明：{dispute.arbitration.note || '—'}</div>
                  <div className="text-xs text-slate-400">{formatTime(dispute.arbitration.created_at)}</div>
                </div>
              </div>
            ) : canArbitrate ? (
              <div className="card p-4">
                <h3 className="mb-3 text-sm font-medium text-slate-700">处理</h3>
                {dispute.status === 'open' && (
                  <button className="btn-secondary mb-3" onClick={claim} disabled={busy}>
                    认领该争议
                  </button>
                )}
                <div className="space-y-2">
                  <input
                    className="input"
                    placeholder="裁决结论（结论键）*"
                    value={arbForm.decision}
                    onChange={(e) => setArbForm({ ...arbForm, decision: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="裁决标签（可选，JSON 或文本）"
                    value={arbForm.label}
                    onChange={(e) => setArbForm({ ...arbForm, label: e.target.value })}
                  />
                  <textarea
                    className="input h-20"
                    placeholder="裁决说明"
                    value={arbForm.note}
                    onChange={(e) => setArbForm({ ...arbForm, note: e.target.value })}
                  />
                  <button className="btn-primary w-full" onClick={arbitrate} disabled={busy}>
                    提交裁决
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">暂无权限处理该争议</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Tab3：培训模式 ----

function TrainingTab() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fTaskType, setFTaskType] = useState('');
  const [active, setActive] = useState<Quiz | null>(null);

  const [choice, setChoice] = useState('');
  const [freeText, setFreeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; passed: boolean; score: number } | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    fetchList<Quiz>(`/training/quizzes${qs({ task_type: fTaskType, pageSize: 50 })}`)
      .then((r) => {
        setQuizzes(r.list);
        setTotal(r.total);
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [fTaskType]);

  useEffect(() => {
    load();
  }, [load]);

  const openQuiz = (q: Quiz) => {
    setActive(q);
    setChoice('');
    setFreeText('');
    setResult(null);
  };

  const submit = async () => {
    if (!active) return;
    setErr('');
    const hasOptions = Array.isArray(active.options) && active.options.length > 0;
    const answer = hasOptions ? choice : freeText;
    if (!answer) return setErr('请先作答');
    setBusy(true);
    try {
      // 写操作，需要同时读取返回的 message（通过/未通过）与 data
      const res: any = await api(`/training/attempts`, { method: 'POST', body: { quiz: active.id, answer } });
      const data: Attempt = res.data;
      setResult({ message: res.message, passed: data.passed, score: data.score });
      setAttempts((prev) => [data, ...prev].slice(0, 10));
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
          <label className="label">任务类型</label>
          <select className="input" value={fTaskType} onChange={(e) => setFTaskType(e.target.value)}>
            <option value="">全部</option>
            {TASK_TYPES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-slate-500">
          共 <span className="font-medium tabular-nums">{total}</span> 道题
        </div>
      </div>

      {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 题库 */}
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">培训题库</div>
          {loading ? (
            <Loading />
          ) : quizzes.length === 0 ? (
            <Empty text="暂无培训题" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {quizzes.map((q) => (
                <li
                  key={q.id}
                  onClick={() => openQuiz(q)}
                  className={`cursor-pointer px-4 py-3 hover:bg-slate-50 ${active?.id === q.id ? 'bg-indigo-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{q.title}</span>
                    <Pill cls="bg-slate-100 text-slate-600">
                      {q.difficulty_label || q.difficulty}
                    </Pill>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {q.task_type_label || typeLabel(q.task_type)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 作答区 */}
        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <BookOpen className="h-4 w-4 text-slate-400" /> 作答
            </div>
            {!active ? (
              <div className="text-sm text-slate-400">从左侧选择一道题开始作答</div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-800">{active.question}</div>
                {Array.isArray(active.options) && active.options.length > 0 ? (
                  <div className="space-y-1.5">
                    {active.options.map((opt, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          name="quiz-option"
                          checked={choice === String(opt)}
                          onChange={() => setChoice(String(opt))}
                        />
                        {String(opt)}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input className="input" placeholder="输入作答" value={freeText} onChange={(e) => setFreeText(e.target.value)} />
                )}
                {active.reference && (
                  <div className="text-xs text-slate-400">参考：{active.reference}</div>
                )}
                <button className="btn-primary" onClick={submit} disabled={busy}>
                  {busy ? '提交中…' : '提交作答'}
                </button>
                {result && (
                  <div
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      result.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {result.passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {result.message || (result.passed ? '通过' : '未通过')} · 得分 {result.score}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 本次作答记录 */}
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">本次作答记录</div>
            {attempts.length === 0 ? (
              <Empty text="暂无作答记录" />
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">题目</th>
                    <th className="th">结果</th>
                    <th className="th">得分</th>
                    <th className="th">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attempts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="td">#{a.quiz_id}</td>
                      <td className="td">
                        <Pill cls={a.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}>
                          {a.passed ? '通过' : '未通过'}
                        </Pill>
                      </td>
                      <td className="td tabular-nums">{a.score}</td>
                      <td className="td whitespace-nowrap text-xs text-slate-400">{formatTime(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
