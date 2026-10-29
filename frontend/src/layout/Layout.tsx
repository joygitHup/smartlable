import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ListChecks,
  BrainCircuit,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  CalendarClock,
  SlidersHorizontal,
  ShieldCheck,
  Lock,
  Plug,
  Megaphone,
  Bot,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth';
import { ConfirmHost, ToastHost } from '../components/common';

const ALL = ['admin', 'operator', 'annotator', 'engineer', 'pm'];

const NAV = [
  { to: '/dashboard', label: '概览', icon: LayoutDashboard, roles: ALL },
  { to: '/tasks', label: '任务管理', icon: ListChecks, roles: ALL },
  { to: '/specs', label: '标注规范', icon: BookOpen, roles: ALL },
  { to: '/workforce', label: '调度人力', icon: CalendarClock, roles: ['admin', 'operator', 'pm'] },
  { to: '/prelabel', label: '预标注增强', icon: SlidersHorizontal, roles: ['admin', 'operator', 'engineer'] },
  { to: '/quality', label: '质量管控', icon: ShieldCheck, roles: ['admin', 'operator', 'pm', 'engineer'] },
  { to: '/compliance', label: '安全合规', icon: Lock, roles: ['admin'] },
  { to: '/integration', label: '系统集成', icon: Plug, roles: ['admin', 'engineer'] },
  { to: '/ops', label: '运营协作', icon: Megaphone, roles: ALL },
  { to: '/llmops', label: 'LLM 运维', icon: Bot, roles: ['admin', 'engineer'] },
  { to: '/ml', label: '模型迭代', icon: BrainCircuit, roles: ['admin', 'operator', 'engineer'] },
  { to: '/system', label: '系统管理', icon: Settings, roles: ['admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const navs = NAV.filter((n) => !n.roles || n.roles.includes(user?.role || ''));

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200">
      <div className="flex h-16 items-center gap-2 border-b border-slate-700 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-sm font-bold text-white">
          AI
        </div>
        <div>
          <div className="text-sm font-semibold text-white">AI 智能标注</div>
          <div className="text-[10px] text-slate-400">人机协同标注平台</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navs.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`
            }
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-700 p-3">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-600 text-xs font-semibold">
            {(user?.display_name || '?').slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{user?.display_name}</div>
            <div className="text-xs text-indigo-300">{user?.role_label}</div>
          </div>
          <button onClick={onLogout} title="退出登录" className="text-slate-400 hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen">
      {/* 桌面端侧边栏 */}
      <aside className="hidden w-60 flex-none md:block">{sidebar}</aside>
      {/* 移动端抽屉 */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-60">{sidebar}</div>
          <button
            onClick={() => setOpen(false)}
            className="absolute left-[15rem] top-4 text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 flex-none items-center justify-between border-b border-slate-200 bg-white px-5">
          <button className="md:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5 text-slate-500" />
          </button>
          <div className="hidden text-sm text-slate-500 md:block">AI 预标注 → 人工修正 → 模型迭代</div>
          <div className="text-xs text-slate-400">{user?.username}</div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}