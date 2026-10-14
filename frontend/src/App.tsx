import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TaskList from './pages/TaskList';
import TaskDetail from './pages/TaskDetail';
import Labeling from './pages/Labeling';
import Models from './pages/Models';
import System from './pages/System';
import Specs from './pages/Specs';
import Workforce from './pages/Workforce';
import Prelabel from './pages/Prelabel';
import Quality from './pages/Quality';
import Compliance from './pages/Compliance';
import Integration from './pages/Integration';
import Ops from './pages/Ops';
import LLMOps from './pages/LLMOps';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tasks" element={<TaskList />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route path="/tasks/:id/label" element={<Labeling />} />
        <Route path="/specs" element={<Specs />} />
        <Route path="/workforce" element={<Workforce />} />
        <Route path="/prelabel" element={<Prelabel />} />
        <Route path="/quality" element={<Quality />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/integration" element={<Integration />} />
        <Route path="/ops" element={<Ops />} />
        <Route path="/llmops" element={<LLMOps />} />
        <Route path="/ml" element={<Models />} />
        <Route path="/system" element={<System />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}