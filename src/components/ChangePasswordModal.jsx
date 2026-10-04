import React, { useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { adminManage } from '../api';

/**
 * 登录后自行修改密码弹窗（AdminLayout 头部用户菜单入口）
 * 原密码：已设置过密码的管理员必填校验在服务端；未设置过密码（如微信扫码登录）可留空直接设置
 */
export default function ChangePasswordModal({ open, onClose }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await adminManage({
        action: 'changePassword',
        oldPassword: values.oldPassword || '',
        newPassword: values.newPassword,
      });
      if (res.success) {
        message.success(res.message || '密码已修改');
        form.resetFields();
        onClose();
      } else {
        message.error(res.error || '修改失败');
      }
    } catch (e) {
      if (e.errorFields) return;
      message.error('修改失败: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="修改密码"
      open={open}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item
          name="oldPassword"
          label="原密码"
          extra="未设置过密码可留空（如微信扫码登录的账号）"
        >
          <Input.Password placeholder="原密码（未设置过可留空）" autoComplete="current-password" />
        </Form.Item>
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
          label="确认新密码"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password placeholder="再次输入新密码" autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
