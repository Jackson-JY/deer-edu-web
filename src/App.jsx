import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layout/AdminLayout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Schedule from './pages/Schedule';
import Students from './pages/Students';
import Assessment from './pages/Assessment';

export default function App() {
  return (
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
