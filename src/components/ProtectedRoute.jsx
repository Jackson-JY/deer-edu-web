import React from 'react';
import { Navigate } from 'react-router-dom';
import { getToken } from '../cloudbase';

/**
 * 路由守卫：未登录（无 token）跳登录页
 */
export default function ProtectedRoute({ children }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
