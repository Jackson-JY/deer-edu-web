import React, { useMemo } from 'react';
import { Layout, Menu, Dropdown, Space, Avatar, message } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarOutlined,
  TeamOutlined,
  FundOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { getAdminInfo, clearAuth } from '../cloudbase';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/schedule', icon: <CalendarOutlined />, label: '排课管理' },
  { key: '/students', icon: <TeamOutlined />, label: '学生分析' },
  { key: '/assessment', icon: <FundOutlined />, label: '测评报告' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const admin = getAdminInfo();

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
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: onLogout,
      },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={208} breakpoint="lg" collapsedWidth={0}>
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: 1,
          }}
        >
          IELTS 教学后台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ background: '#12b7a8' }} />
              <span>{admin?.nickName || '管理员'}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
