import React, { useState } from 'react';
import { Button, Typography, Input, Tabs, message, Space, Form } from 'antd';
import { WechatOutlined, SafetyCertificateOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { WX_APPID, getWxRedirectUri } from '../../config';
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

  // 微信扫码登录：整页跳转到微信扫码，扫码后回调 /auth/callback
  const handleWechatLogin = () => {
    if (!WX_APPID) {
      message.warning('请先在 src/config.js 中配置微信开放平台「网站应用」AppID');
      return;
    }
    const redirectUri = encodeURIComponent(getWxRedirectUri());
    const state = Math.random().toString(36).slice(2, 10);
    const url =
      `https://open.weixin.qq.com/connect/qrconnect` +
      `?appid=${WX_APPID}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
    window.location.href = url;
  };

  // 账号密码登录（兜底，无需开放平台资质）
  const handlePasswordLogin = async () => {
    const values = await passwordForm.validateFields();
    setLoading(true);
    try {
      const res = await adminLogin({ action: 'password', username: values.username, password: values.password });
      if (res.success) afterLogin(res);
      else message.error(res.error || '登录失败');
    } catch (e) {
      message.error(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 开发模式登录：直接指定管理员 openid，云函数侧 ALLOW_DEV_LOGIN=true 时可用
  const handleDevLogin = async () => {
    const openid = document.getElementById('dev-openid')?.value || '';
    if (!openid.trim()) {
      message.warning('请输入管理员 openid');
      return;
    }
    setLoading(true);
    try {
      const res = await adminLogin({ action: 'dev', openid: openid.trim() });
      if (res.success) afterLogin(res);
      else message.error(res.error || '登录失败');
    } catch (e) {
      message.error(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <Title level={3} style={{ marginBottom: 4 }}>
          IELTS 教学管理后台
        </Title>
        <Text type="secondary">排课 · 学生分析 · 测评报告</Text>

        <Tabs
          centered
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'wechat',
              label: '微信扫码',
              children: (
                <div style={{ padding: '8px 0 4px' }}>
                  <Button type="primary" size="large" block icon={<WechatOutlined />} onClick={handleWechatLogin}>
                    微信扫码登录
                  </Button>
                  <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
                    需在微信开放平台创建「网站应用」并绑定小程序
                  </Text>
                </div>
              ),
            },
            {
              key: 'password',
              label: '账号密码',
              children: (
                <Form form={passwordForm} layout="vertical" style={{ textAlign: 'left' }}>
                  <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
                    <Input prefix={<UserOutlined />} placeholder="管理员登录名" size="large" />
                  </Form.Item>
                  <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
                  </Form.Item>
                  <Button type="primary" size="large" block loading={loading} onClick={handlePasswordLogin}>
                    登录
                  </Button>
                </Form>
              ),
            },
            {
              key: 'dev',
              label: '开发模式',
              children: (
                <div style={{ padding: '8px 0 4px' }}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input id="dev-openid" placeholder="管理员 openid" prefix={<SafetyCertificateOutlined />} onPressEnter={handleDevLogin} />
                    <Button type="primary" loading={loading} onClick={handleDevLogin}>
                      登录
                    </Button>
                  </Space.Compact>
                  <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
                    仅本地联调，需云函数配 ALLOW_DEV_LOGIN=true
                  </Text>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
