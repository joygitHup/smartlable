import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { DashboardData } from '../types';
import { Stat, Loading, StatusBadge, Empty } from '../components/common';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<DashboardData>('/dashboard')
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <Empty text={err} />;
  if (!data) return <Loading />;

  const dist = data.status_counts || {};
  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">概览</h1>
          <p className="text-sm text-slate-500">AI 智能标注系统运行态势</p>
        </div>
        <Link to="/tasks" className="btn-primary">
          前往任务管理
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="标注任务" value={data.tasks_total} />
        <Stat label="数据样本" value={data.units_total} />
        <Stat label="待人工审核" value={data.units_pending_review} />
        <Stat label="模型记录" value={data.models_total} />
        <Stat label="AI 预标注通过率" value={data.ai_pass_rate} suffix="%" />
        <Stat label="人工修正率" value={data.modify_rate} suffix="%" />
        <Stat label="已审核样本" value={data.units_reviewed} />
        <Stat label="24h 关键操作" value={data.recent_activity_24h} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-medium text-slate-700">数据样本状态分布</h3>
          {Object.keys(dist).length === 0 ? (
            <Empty text="暂无样本" />
          ) : (
            <div className="space-y-3">
              {Object.entries(dist).map(([k, v]) => (
                <div key={k}>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <StatusBadge status={k} />
                    <span className="tabular-nums">{v}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${Math.min(100, (v / distTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="mb-3 text-sm font-medium text-slate-700">人机协同运行指标</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md bg-emerald-50 p-4">
              <div className="tabular-nums text-2xl font-semibold text-emerald-600">{data.ai_pass_rate}%</div>
              <div className="text-xs text-emerald-700">AI 自动通过占比（目标 ≥60%）</div>
              <div className="mt-1 text-[11px] text-emerald-600">
                {data.ai_auto} / {data.ai_total} 条高置信通过
              </div>
            </div>
            <div className="rounded-md bg-amber-50 p-4">
              <div className="tabular-nums text-2xl font-semibold text-amber-600">{data.modify_rate}%</div>
              <div className="text-xs text-amber-700">人工修正率（目标 ≤30%）</div>
              <div className="mt-1 text-[11px] text-amber-600">
                {data.units_modified} / {data.units_reviewed} 条被修正
              </div>
            </div>
            <div className="col-span-2 rounded-md bg-slate-50 p-4 text-xs text-slate-500">
              成功指标：标注效率提升 ≥50%、单条成本下降 ≥40%、准确率保持 ≥95%（黄金标准集抽检）。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}