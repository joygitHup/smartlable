import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, RotateCcw, Sparkles, Keyboard } from 'lucide-react';
import { api } from '../api';
import { TaskItem, UnitItem } from '../types';
import { ConfidenceBar, StatusBadge, TaskTypeTag, Loading, Empty, toast } from '../components/common';

export default function Labeling() {
  const { id } = useParams();
  const tid = Number(id);
  const [task, setTask] = useState<TaskItem | null>(null);
  const [current, setCurrent] = useState<UnitItem | null>(null);
  const [noPending, setNoPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [taskErr, setTaskErr] = useState('');
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const keyRef = useRef<{ selected: string | null; reason: string }>({ selected: null, reason: '' });
  keyRef.current = { selected, reason };

  const labels = task?.spec?.labels || [];

  const loadNext = useCallback(async () => {
    setLoading(true);
    setMsg('');
    setSelected(null);
    setReason('');
    try {
      const d = await api<UnitItem & { no_pending?: boolean; message?: string }>(`/tasks/${tid}/queue`);
      if (d.no_pending) {
        setNoPending(true);
        setCurrent(null);
      } else {
        setNoPending(false);
        setCurrent(d);
        // 默认选中与 AI 建议一致的标签（便于一键 accept）
        setSelected(aiLabelOf(d));
      }
    } catch (e: any) {
      setMsg(`加载失败：${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [tid]);

  useEffect(() => {
    setTaskErr('');
    api<TaskItem>(`/tasks/${tid}`)
      .then(setTask)
      .catch((e) => setTaskErr(e.message || '任务加载失败'));
    loadNext();
  }, [tid, loadNext]);

  const submit = async (action: 'accept' | 'modify') => {
    if (!current) return;
    setBusy(true);
    setMsg('');
    try {
      if (action === 'accept') {
        await api(`/units/${current.id}/review`, { method: 'POST', body: { action: 'accept' } });
      } else {
        await api(`/units/${current.id}/review`, {
          method: 'POST',
          body: { action: 'modify', label: keyRef.current.selected || null, reason: keyRef.current.reason },
        });
      }
      toast.success('提交成功');
      await loadNext();
    } catch (e: any) {
      setMsg(`提交失败：${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // 快捷键
  useEffect(() => {
    if (noPending) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1;
        if (idx < labels.length) setSelected(labels[idx]);
      } else if (e.key === 'Enter') {
        if (!busyRef.current) submit('accept');
      } else if (e.key.toLowerCase() === 'm') {
        if (!busyRef.current) submit('modify');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current?.id]);

  if (taskErr) {
    return (
      <div className="space-y-3">
        <Link to={`/tasks/${tid}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
          <ArrowLeft className="h-4 w-4" /> 返回任务
        </Link>
        <Empty text={`任务信息加载失败：${taskErr}`} />
      </div>
    );
  }
  if (!task) return <Loading />;

  return (
    <div className="h-[calc(100vh-5rem)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/tasks/${tid}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
            <ArrowLeft className="h-4 w-4" /> 返回任务
          </Link>
          <span className="h-4 w-px bg-slate-200" />
          <h1 className="text-lg font-semibold">{task.name}</h1>
          <TaskTypeTag type={task.task_type} />
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <StatusBadge status={task.status} />
          <span>阈值 {task.confidence_threshold}</span>
        </div>
      </div>

      {msg && <div className="mb-3 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600">{msg}</div>}

      <div className="grid h-[calc(100%-3rem)] grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 内容区 */}
        <div className="card flex flex-col overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">待标注样本</span>
            {current && (
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <StatusBadge status={current.status} />
                <span>#{current.id}</span>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <Loading />
            ) : noPending ? (
              <Empty text="当前没有待审核样本。可运行 AI 预标注或人工入队生成工作项。" />
            ) : current ? (
              <div className="space-y-5">
                <p className="rounded-lg bg-slate-50 p-4 text-[15px] leading-relaxed text-slate-800">{current.content}</p>

                {/* AI 预标注高亮展示 */}
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-indigo-600">
                    <Sparkles className="h-3.5 w-3.5" /> AI 预标注建议 · {current.ai_model || 'AI model'}
                  </div>
                  {current.ai_prediction ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">建议标签：</span>
                        <span className="badge bg-indigo-100 text-indigo-700">
                          {aiLabelOf(current)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        置信度
                        <span className="ml-2">
                          <ConfidenceBar confidence={current.confidence} threshold={task.confidence_threshold} />
                        </span>
                        {current.confidence !== null &&
                          current.confidence !== undefined &&
                          current.confidence < task.confidence_threshold && (
                            <span className="ml-2 text-amber-600">低于阈值 → 需人工确认</span>
                          )}
                      </div>
                      {Array.isArray(current.ai_prediction.entities) && current.ai_prediction.entities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {current.ai_prediction.entities.map((e: any, i: number) => (
                            <span key={i} className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                              实体 {i + 1}: {e.text}（{e.type}）
                            </span>
                          ))}
                        </div>
                      )}
                      {current.ai_prediction.explanation && (
                        <p className="text-xs text-slate-500">› {current.ai_prediction.explanation}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">该样本尚未经 AI 预标注，请人工标注。</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* 操作区 */}
        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Check className="h-4 w-4 text-emerald-500" /> 人工确认
            </h3>
            <p className="mb-3 text-xs text-slate-500">选择最终标签。与 AI 建议相同 → 直接确认；不同 → 记录为修正。</p>
            <div className="grid grid-cols-1 gap-2">
              {labels.map((l, i) => {
                const active = selected === l;
                return (
                  <button
                    key={l}
                    onClick={() => setSelected(l)}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span>{l}</span>
                    <span className="text-[10px] text-slate-300">{i < 9 ? i + 1 : ''}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3">
              <label className="label">修正原因（可选，用于模型分析）</label>
              <textarea
                className="input"
                rows={2}
                placeholder="例如：模型误判为负面，实际为中性"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="btn-secondary" disabled={busy || !current} onClick={() => submit('accept')}>
                <Check className="h-4 w-4" /> 确认 AI 结果
              </button>
              <button className="btn-primary" disabled={busy || !current} onClick={() => submit('modify')}>
                <RotateCcw className="h-4 w-4" /> 提交修正
              </button>
            </div>
          </div>

          <div className="card p-4 text-xs text-slate-500">
            <div className="mb-2 flex items-center gap-1.5 font-medium text-slate-600">
              <Keyboard className="h-4 w-4" /> 快捷键
            </div>
            <ul className="space-y-1">
              <li><Key k="1-9" /> 选择标签</li>
              <li><Key k="Enter" /> 确认 AI 结果</li>
              <li><Key k="M" /> 提交修正</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Key({ k }: { k: string }) {
  return <kbd className="mr-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">{k}</kbd>;
}

export function aiLabelOf(u: UnitItem | null): string {
  if (!u?.ai_prediction) return '';
  const p = u.ai_prediction;
  if (typeof p === 'string') return p;
  if (p.label !== undefined) return String(p.label);
  if (Array.isArray(p.entities)) return p.entities.map((e: any) => e.type || e.text).join('、');
  return JSON.stringify(p);
}