import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layout/AdminLayout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';

// 路由页面懒加载（echarts 等大依赖按需加载，减小主包体积）
const Schedule = lazy(() => import('./pages/Schedule'));
const Students = lazy(() => import('./pages/Students'));
const Assessment = lazy(() => import('./pages/Assessment'));
const Checkin = lazy(() => import('./pages/Checkin'));

function PageFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      加载中…
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/schedule" replace />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="students" element={<Students />} />
          <Route path="assessment" element={<Assessment />} />
          <Route path="checkin" element={<Checkin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
