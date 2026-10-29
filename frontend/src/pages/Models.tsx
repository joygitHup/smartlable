import { useEffect, useState } from 'react';
import { Plus, Scale, X } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ModelItem } from '../types';
import { Loading, Empty, toast } from '../components/common';

const MODEL_STATUS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-100 text-emerald-700',
  retired: 'bg-slate-200 text-slate-500',
};

export default function Models() {
  const { hasPerm } = useAuth();
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [cmp, setCmp] = useState<{ model_a: any; model_b: any; recommend: string } | null>(null);
  const [cmpA, setCmpA] = useState({ name: '模型A(新)', accuracy: 95, f1: 0.93 });
  const [cmpB, setCmpB] = useState({ name: '模型B(旧)', accuracy: 91, f1: 0.89 });
  const [cmpBusy, setCmpBusy] = useState(false);
  const [cmpErr, setCmpErr] = useState('');

  const canManage = hasPerm('ml:manage');

  const load = () => {
    setLoading(true);
    api<ModelItem[]>('/ml/models')
      .then(setModels)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const doCompare = async () => {
    if (cmpBusy) return;
    setCmpBusy(true);
    setCmpErr('');
    try {
      const d = await api('/ml/compare', { method: 'POST', body: { model_a: cmpA, model_b: cmpB } });
      setCmp(d);
      toast.success('对比完成');
    } catch (e: any) {
      setCmpErr(e.message || '对比失败');
    } finally {
      setCmpBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">模型迭代</h1>
          <p className="text-sm text-slate-500">数据回流、模型记录与效果对比，驱动“数据飞轮”</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 登记模型
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Scale className="h-4 w-4 text-indigo-500" /> 模型效果对比（验证集）
          </h3>
          <div className="space-y-2">
            {[
              { label: '新模型', v: cmpA, set: setCmpA },
              { label: '旧模型', v: cmpB, set: setCmpB },
            ].map(({ label, v, set }) => (
              <div key={label} className="grid grid-cols-3 items-center gap-2">
                <span className="text-xs text-slate-500">{label}</span>
                <input className="input" value={v.name} onChange={(e) => set({ ...v, name: e.target.value })} />
                <div className="flex gap-2">
                  <input
                    className="input"
                    type="number"
                    placeholder="准确率"
                    value={v.accuracy}
                    onChange={(e) => set({ ...v, accuracy: Number(e.target.value) })}
                  />
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    placeholder="F1"
                    value={v.f1}
                    onChange={(e) => set({ ...v, f1: Number(e.target.value) })}
                  />
                </div>
              </div>
            ))}
            <button className="btn-secondary w-full" onClick={doCompare} disabled={cmpBusy}>
              {cmpBusy ? '对比中…' : '对比'}
            </button>
            {cmpErr && <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-600">{cmpErr}</div>}
            {cmp && (
              <div className="rounded-md bg-indigo-50 p-3 text-sm text-indigo-700">
                推荐方案：{cmp.recommend}
              </div>
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">模型记录</div>
          {loading ? (
            <Loading />
          ) : models.length === 0 ? (
            <Empty text="暂无模型记录。数据回流后会生成回流快照。" />
          ) : (
            models.map((m) => (
              <div key={m.id} className="border-b border-slate-50 px-4 py-3 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{m.name}</span>
                  <span className={`badge ${MODEL_STATUS[m.status] || 'bg-slate-100 text-slate-600'}`}>{m.status_label}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">模型 ID：{m.model_id} · 类型：{m.task_type}</div>
                <p className="mt-1 text-xs text-slate-400">{m.description}</p>
                {Object.keys(m.metrics || {}).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {Object.entries(m.metrics).map(([k, v]) => (
                      <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-1 text-[11px] text-slate-300">{m.created_by} · {m.created_at?.slice(0, 16).replace('T', ' ')}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCreate && <CreateModelModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function CreateModelModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    model_id: '',
    task_type: 'classification',
    description: '',
    metrics: '',
    status: 'draft',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!form.name.trim() || !form.model_id.trim()) return setErr('请填写模型名称与模型 ID');
    setBusy(true);
    try {
      const metrics: Record<string, number> = {};
      form.metrics.split(/[,，]/).forEach((kv) => {
        const [k, v] = kv.split(':');
        if (k && v !== undefined) metrics[k.trim()] = Number(v);
      });
      await api('/ml/models', {
        method: 'POST',
        body: { ...form, metrics },
      });
      toast.success(`模型「${form.name.trim()}」已登记`);
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
          <h2 className="text-lg font-semibold">登记模型</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="label">模型名称 *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">模型 ID *</label><input className="input" value={form.model_id} onChange={(e) => setForm({ ...form, model_id: e.target.value })} /></div>
            <div><label className="label">类型</label>
              <select className="input" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>
                <option value="classification">分类</option><option value="sentiment">情感</option><option value="entity">实体</option>
              </select>
            </div>
          </div>
          <div><label className="label">描述</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">指标（accuracy:95,f1:0.93）</label><input className="input" value={form.metrics} onChange={(e) => setForm({ ...form, metrics: e.target.value })} /></div>
          <div><label className="label">状态</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">draft</option><option value="active">active</option>
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