import React, { useEffect, useMemo, useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, message, Grid, Drawer } from 'antd';
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
  MenuOutlined,
} from '@ant-design/icons';
import { getAdminInfo, clearAuth } from '../cloudbase';
import ChangePasswordModal from '../components/ChangePasswordModal';

const { Sider, Header, Content } = Layout;
const { useBreakpoint } = Grid;

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
  const screens = useBreakpoint();
  const isMobile = !screens.lg;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 路由切换后，移动端自动关闭抽屉
  useEffect(() => {
    if (isMobile) setDrawerOpen(false);
  }, [location.pathname, isMobile]);

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

  const menu = (
    <Menu
      className="admin-menu"
      mode="inline"
      selectedKeys={[selectedKey]}
      items={menuItems}
      onClick={({ key }) => navigate(key)}
    />
  );

  const siderLogo = (
    <div className="admin-logo">
      <span className="admin-logo-mark">
        <img src="/logo.jpg" alt="Deer Edu" />
      </span>
      <span className="admin-logo-text">Deer Edu</span>
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        // 手机端：抽屉式侧边栏
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={240}
          styles={{ body: { padding: 0 } }}
          drawerStyle={{ background: '#fff' }}
          closable={false}
        >
          {siderLogo}
          {menu}
        </Drawer>
      ) : (
        // 桌面端：常驻侧边栏
        <Sider width={216} breakpoint="lg" collapsedWidth={0} className="admin-sider">
          {siderLogo}
          {menu}
        </Sider>
      )}
      <Layout>
        <Header className="admin-header">
          {isMobile && (
            <button
              className="admin-hamburger"
              onClick={() => setDrawerOpen(true)}
              aria-label="打开菜单"
            >
              <MenuOutlined />
            </button>
          )}
          <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
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
