import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { TaskItem } from '../types';
import { StatusBadge, TaskTypeTag, PRIORITY_META, Loading, Empty, toast } from '../components/common';

export default function TaskList() {
  const { hasPerm } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    api<TaskItem[]>('/tasks')
      .then(setTasks)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = tasks.filter((t) => (q ? t.name.includes(q) : true));
  const canManage = hasPerm('task:manage');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">任务管理</h1>
          <p className="text-sm text-slate-500">创建标注任务、配置 AI 预标注与审核策略</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 新建任务
          </button>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="搜索任务…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty text="暂无任务，点击右上角新建" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">任务</th>
                <th className="th">类型</th>
                <th className="th">优先级</th>
                <th className="th">状态</th>
                <th className="th">样本数</th>
                <th className="th">阈值</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/tasks/${t.id}`)}>
                  <td className="td max-w-xs">
                    <div className="truncate font-medium text-slate-800">{t.name}</div>
                    <div className="truncate text-xs text-slate-400">{t.description}</div>
                  </td>
                  <td className="td"><TaskTypeTag type={t.task_type} /></td>
                  <td className="td">
                    <span className={`badge ${PRIORITY_META[t.priority]?.cls || 'bg-slate-100 text-slate-600'}`}>
                      {PRIORITY_META[t.priority]?.label || t.priority}
                    </span>
                  </td>
                  <td className="td"><StatusBadge status={t.status} /></td>
                  <td className="td tabular-nums">{t.units_total}</td>
                  <td className="td tabular-nums">{t.confidence_threshold}</td>
                  <td className="td text-right">
                    <Link to={`/tasks/${t.id}/label`} className="text-xs font-medium text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                      去标注
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function CreateTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    task_type: 'sentiment',
    modality: 'text',
    labels: '正向,负面,中性',
    instructions: '',
    ai_enabled: true,
    confidence_threshold: 0.8,
    manual_review_ratio: 0.3,
    priority: 'normal',
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!form.name.trim()) return setErr('请填写任务名称');
    setSubmitting(true);
    try {
      await api('/tasks', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          description: form.description,
          task_type: form.task_type,
          modality: form.modality,
          priority: form.priority,
          ai_enabled: form.ai_enabled,
          confidence_threshold: Number(form.confidence_threshold),
          manual_review_ratio: Number(form.manual_review_ratio),
          spec: {
            labels: form.labels.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
            instructions: form.instructions,
          },
        },
      });
      toast.success('任务已创建');
      onCreated();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">新建标注任务</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">任务名称 *</label>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="例如：电商评论情感分析" />
          </div>
          <div>
            <label className="label">任务描述</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">任务类型</label>
              <select className="input" value={form.task_type} onChange={(e) => set('task_type', e.target.value)}>
                <option value="classification">文本分类</option>
                <option value="sentiment">情感分析</option>
                <option value="entity">实体抽取</option>
                <option value="object_detection">目标检测</option>
              </select>
            </div>
            <div>
              <label className="label">优先级</label>
              <select className="input" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                <option value="urgent">紧急</option>
                <option value="high">高</option>
                <option value="normal">普通</option>
                <option value="low">低</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">候选标签（逗号分隔）</label>
            <input className="input" value={form.labels} onChange={(e) => set('labels', e.target.value)} />
          </div>
          <div>
            <label className="label">标注规范说明</label>
            <textarea className="input" rows={2} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="供 AI 模型与标注员参考的规范" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">置信度阈值（≥ 自动通过）</label>
              <input className="input" type="number" step="0.05" min="0" max="1" value={form.confidence_threshold} onChange={(e) => set('confidence_threshold', e.target.value)} />
            </div>
            <div>
              <label className="label">人工复核比例</label>
              <input className="input" type="number" step="0.1" min="0" max="1" value={form.manual_review_ratio} onChange={(e) => set('manual_review_ratio', e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.ai_enabled} onChange={(e) => set('ai_enabled', e.target.checked)} />
            启用 AI 预标注
          </label>
          {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" disabled={submitting}>{submitting ? '创建中…' : '创建任务'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}