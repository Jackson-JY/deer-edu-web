import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  Space,
  Empty,
  message,
} from 'antd';
import { ReloadOutlined, UserAddOutlined, KeyOutlined } from '@ant-design/icons';
import { adminManage } from '../api';

export default function Admins() {
  const [addForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState([]);

  // 新增弹窗
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  // 重置密码弹窗
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminManage({ action: 'list' });
      if (res.success) {
        setAdmins(res.admins || []);
      } else {
        message.error(res.error || '加载管理员列表失败');
      }
    } catch (e) {
      message.error('加载管理员列表失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  // 新增管理员
  const handleAdd = async () => {
    try {
      const values = await addForm.validateFields();
      setAdding(true);
      const res = await adminManage({
        action: 'add',
        username: values.username.trim(),
        password: values.password,
        nickName: values.nickName.trim(),
      });
      if (res.success) {
        message.success(res.message || '管理员已创建');
        setAddOpen(false);
        addForm.resetFields();
        loadAdmins();
      } else {
        message.error(res.error || '创建失败');
      }
    } catch (e) {
      if (e.errorFields) return;
      message.error('创建失败: ' + e.message);
    } finally {
      setAdding(false);
    }
  };

  // 重置密码
  const handleReset = async () => {
    try {
      const values = await resetForm.validateFields();
      setResetting(true);
      const res = await adminManage({
        action: 'resetPassword',
        userId: resetTarget.userId,
        newPassword: values.newPassword,
      });
      if (res.success) {
        message.success(res.message || '密码已重置');
        setResetOpen(false);
        resetForm.resetFields();
        loadAdmins();
      } else {
        message.error(res.error || '重置失败');
      }
    } catch (e) {
      if (e.errorFields) return;
      message.error('重置失败: ' + e.message);
    } finally {
      setResetting(false);
    }
  };

  const openReset = (row) => {
    setResetTarget(row);
    resetForm.resetFields();
    setResetOpen(true);
  };

  const columns = [
    {
      title: '昵称',
      dataIndex: 'nickName',
      key: 'nickName',
      width: 180,
      render: (v, row) => (
        <Space size={6}>
          <span>{v}</span>
          {row.isSelf && <Tag color="geekblue">当前账号</Tag>}
        </Space>
      ),
    },
    {
      title: '登录账号',
      dataIndex: 'adminUsername',
      key: 'adminUsername',
      width: 160,
      render: (v) => (v ? <span>{v}</span> : <span style={{ color: '#8E8E93' }}>未设置</span>),
    },
    {
      title: '登录方式',
      key: 'auth',
      width: 220,
      render: (_, row) => (
        <Space size={4} wrap>
          {row.hasPassword ? <Tag color="green">密码</Tag> : <Tag>无密码</Tag>}
          {row.hasWxBind ? <Tag color="green">微信扫码</Tag> : <Tag>仅密码登录</Tag>}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, row) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0 }}
          icon={<KeyOutlined />}
          onClick={() => openReset(row)}
        >
          重置密码
        </Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">管理员管理</h2>
        <p className="page-desc">新增后台管理员账号，管理登录密码</p>
      </div>

      <Card
        title="管理员列表"
        extra={
          <Space>
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => setAddOpen(true)}>
              新增管理员
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadAdmins}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={admins}
          rowKey="userId"
          loading={loading}
          pagination={false}
          size="middle"
          locale={{
            emptyText: <Empty description="暂无管理员数据" />,
          }}
        />
      </Card>

      {/* 新增管理员弹窗 */}
      <Modal
        title="新增管理员"
        open={addOpen}
        onOk={handleAdd}
        onCancel={() => setAddOpen(false)}
        confirmLoading={adding}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="nickName"
            label="昵称"
            rules={[{ required: true, message: '请输入昵称' }]}
          >
            <Input placeholder="后台显示的名称" maxLength={20} />
          </Form.Item>
          <Form.Item
            name="username"
            label="登录账号"
            rules={[
              { required: true, message: '请输入登录账号' },
              { pattern: /^[A-Za-z0-9_]{3,20}$/, message: '3-20 位字母、数字或下划线' },
            ]}
          >
            <Input placeholder="用于账号密码登录" maxLength={20} autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="password"
            label="初始密码"
            rules={[
              { required: true, message: '请输入初始密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password placeholder="至少 6 位" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入密码" autoComplete="new-password" />
          </Form.Item>
        </Form>
        <p style={{ color: '#8E8E93', fontSize: 12, margin: '4px 0 0' }}>
          新账号通过「账号密码登录」进入后台；创建后可在列表中重置其密码。
        </p>
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        title={`重置密码 · ${resetTarget?.nickName || ''}`}
        open={resetOpen}
        onOk={handleReset}
        onCancel={() => setResetOpen(false)}
        confirmLoading={resetting}
        okText="重置"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={resetForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password placeholder="至少 6 位" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="确认密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入密码" autoComplete="new-password" />
          </Form.Item>
        </Form>
        <p style={{ color: '#8E8E93', fontSize: 12, margin: '4px 0 0' }}>
          重置后该管理员的所有登录态将失效，需用新密码重新登录。
        </p>
      </Modal>
    </div>
  );
}
