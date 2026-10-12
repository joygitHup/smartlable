import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { BrainCircuit } from 'lucide-react';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('annotate123');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || '登录失败');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">AI 智能标注系统</h1>
              <p className="text-xs text-slate-500">AI 预标注 → 人工修正 → 模型迭代</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">用户名</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">密码</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
            <button className="btn-primary w-full" disabled={loading} type="submit">
              {loading ? '登录中…' : '登 录'}
            </button>
          </form>
          <div className="mt-5 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
            <div className="mb-1 font-medium text-slate-600">演示账号（密码均为 annotate123）</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              <span>admin（管理员）</span>
              <span>operator（运营）</span>
              <span>annotator（标注员）</span>
              <span>engineer（算法）</span>
              <span>pm（项目经理）</span>
              <span>annotator2（标注员）</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}