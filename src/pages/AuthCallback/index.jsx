import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Spin, Typography, Result, Button } from 'antd';
import { adminLogin } from '../../api';
import { setToken, setAdminInfo } from '../../cloudbase';

const { Text } = Typography;

/**
 * 微信扫码回调页：读取 code → adminLogin 换 token → 跳转后台
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('未获取到微信授权 code');
      return;
    }
    (async () => {
      try {
        const res = await adminLogin({ action: 'wechat', code });
        if (res.success) {
          setToken(res.token);
          setAdminInfo(res.admin || {});
          navigate('/schedule', { replace: true });
        } else {
          setError(res.error || '登录失败');
        }
      } catch (e) {
        setError(e.message || '登录失败');
      }
    })();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Result
          status="error"
          title="登录失败"
          subTitle={error}
          extra={
            <Button type="primary" onClick={() => navigate('/login')}>
              返回登录
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">正在验证管理员身份…</Text>
        </div>
      </div>
    </div>
  );
}
