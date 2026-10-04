import React, { useMemo, useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, message } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarOutlined,
  TeamOutlined,
  FundOutlined,
  CheckCircleOutlined,
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined,
  SafetyOutlined,
  UsergroupAddOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { getAdminInfo, clearAuth } from '../cloudbase';
import ChangePasswordModal from '../components/ChangePasswordModal';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '数据看板' },
  { key: '/schedule', icon: <CalendarOutlined />, label: '排课管理' },
  { key: '/students', icon: <TeamOutlined />, label: '学生分析' },
  { key: '/assessment', icon: <FundOutlined />, label: '测评报告' },
  { key: '/grants', icon: <SafetyOutlined />, label: '测评授权' },
  { key: '/checkin', icon: <CheckCircleOutlined />, label: '打卡管理' },
  { key: '/admins', icon: <UsergroupAddOutlined />, label: '管理员管理' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const admin = getAdminInfo();
  const [pwdOpen, setPwdOpen] = useState(false);

  const selectedKey = useMemo(() => {
    const path = location.pathname;
    const hit = menuItems.find((m) => path.startsWith(m.key));
    return hit ? hit.key : '/schedule';
  }, [location.pathname]);

  const onLogout = () => {
    clearAuth();
    message.success('已退出登录');
    navigate('/login');
  };

  const userMenu = {
    items: [
      {
        key: 'password',
        icon: <LockOutlined />,
        label: '修改密码',
        onClick: () => setPwdOpen(true),
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: onLogout,
      },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={216} breakpoint="lg" collapsedWidth={0} className="admin-sider">
        <div className="admin-logo">
          <span className="admin-logo-mark">
            <img src="/logo.jpg" alt="Deer Edu" />
          </span>
          <span className="admin-logo-text">Deer Edu</span>
        </div>
        <Menu
          className="admin-menu"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <Dropdown menu={userMenu} placement="bottomRight">
            <div className="admin-user">
              <Avatar size={28} icon={<UserOutlined />} style={{ background: '#12B7A8', flexShrink: 0 }} />
              <span>{admin?.nickName || '管理员'}</span>
            </div>
          </Dropdown>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </Layout>
  );
}
