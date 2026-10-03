import React, { useState } from 'react';
import { Button, Typography, Input, message, Form } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../../api';
import { setToken, setAdminInfo } from '../../cloudbase';

const { Title, Text } = Typography;

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [passwordForm] = Form.useForm();

  const afterLogin = (res) => {
    setToken(res.token);
    setAdminInfo(res.admin || {});
    message.success('登录成功');
    navigate('/schedule');
  };

  // 账号密码登录
  const handlePasswordLogin = async () => {
    const values = await passwordForm.validateFields();
    setLoading(true);
    try {
      const res = await adminLogin({ action: 'password', username: values.username, password: values.password });
      if (res.success) afterLogin(res);
      else message.error(res.error || '登录失败');
    } catch (e) {
      if (e?.errorFields) return; // 表单校验失败
      message.error(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.jpg" alt="Deer Edu" />
        </div>
        <Title level={3} style={{ marginBottom: 4, letterSpacing: '-0.02em' }}>
          Deer Edu
        </Title>
        <Text type="secondary">排课 · 学生分析 · 测评报告</Text>

        <Form
          form={passwordForm}
          layout="vertical"
          style={{ textAlign: 'left', marginTop: 24 }}
          onFinish={handlePasswordLogin}
        >
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input prefix={<UserOutlined />} placeholder="管理员登录名" size="large" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" size="large" block loading={loading} onClick={handlePasswordLogin}>
            登录
          </Button>
        </Form>
      </div>
    </div>
  );
}
