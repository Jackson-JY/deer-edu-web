import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Table,
  Tag,
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  Space,
  Statistic,
  Empty,
  message,
} from 'antd';
import {
  ReloadOutlined,
  SafetyOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { assessmentGrant } from '../api';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 解析截止时间（可能是 'YYYY-MM-DD' 字符串、ISO 字符串或空），返回时间戳或 null */
function parseExpireTs(v) {
  if (v === null || v === undefined || v === '') return null;
  const ts = new Date(v).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function startOfTodayTs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 计算单个学生的授权状态 */
function getGrantStatus(row) {
  const g = row.grant;
  if (!g) return { type: 'none' };
  if (g.status === 'revoked') return { type: 'revoked' };
  const ts = parseExpireTs(g.expireAt);
  const expired = ts != null && ts < startOfTodayTs();
  const remaining = Math.max(0, (g.totalQuota || 0) - (g.usedCount || 0));
  if (expired) return { type: 'expired' };
  if (remaining <= 0) return { type: 'exhausted' };
  return { type: 'active', remaining };
}

const STATUS_TAG = {
  active: { color: 'green' },
  none: { color: 'default' },
  revoked: { color: 'red' },
  expired: { color: 'orange' },
  exhausted: { color: 'orange' },
};

function renderStatusTag(row) {
  const st = getGrantStatus(row);
  const color = STATUS_TAG[st.type].color;
  let text = '未授权';
  if (st.type === 'active') text = `已授权 · 剩余${st.remaining}次`;
  else if (st.type === 'revoked') text = '已吊销';
  else if (st.type === 'expired') text = '已过期';
  else if (st.type === 'exhausted') text = '次数用尽';
  return <Tag color={color}>{text}</Tag>;
}

export default function Grants() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [grants, setGrants] = useState([]);
  const [students, setStudents] = useState([]);

  // 授权 / 调整弹窗
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增授权，否则为被调整的学生行
  const [submitting, setSubmitting] = useState(false);

  const loadGrants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await assessmentGrant({ action: 'list' });
      if (res.success) {
        setGrants(res.grants || []);
        setStudents(res.students || []);
      } else {
        message.error(res.error || '加载授权列表失败');
      }
    } catch (e) {
      message.error('加载授权列表失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGrants();
  }, [loadGrants]);

  // 顶部统计
  const stats = useMemo(() => {
    const startToday = startOfTodayTs();
    const in7Days = startToday + 7 * DAY_MS;
    let active = 0;
    let remainingTotal = 0;
    let expiringSoon = 0;
    grants.forEach((g) => {
      const remaining = Math.max(0, (g.totalQuota || 0) - (g.usedCount || 0));
      remainingTotal += remaining;
      if (g.status !== 'revoked') {
        const ts = parseExpireTs(g.expireAt);
        const expired = ts != null && ts < startToday;
        if (!expired && remaining > 0) {
          active += 1;
          if (ts != null && ts <= in7Days) expiringSoon += 1;
        }
      }
    });
    return { total: grants.length, active, remainingTotal, expiringSoon };
  }, [grants]);

  // 表格数据：全体学生 + 授权信息合并
  const dataSource = useMemo(() => {
    const grantMap = {};
    grants.forEach((g) => {
      grantMap[g.userId] = g;
    });
    return (students || []).map((s) => ({
      ...s,
      grant: grantMap[s.userId] || null,
    }));
  }, [grants, students]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    form.setFieldsValue({
      totalQuota: row.grant?.totalQuota,
      expireAt: parseExpireTs(row.grant?.expireAt) != null ? dayjs(row.grant.expireAt) : undefined,
      note: row.grant?.note || '',
    });
    setModalOpen(true);
  };

  // 提交授权 / 调整
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await assessmentGrant({
        action: 'grant',
        userId: editing ? editing.userId : values.userId,
        totalQuota: values.totalQuota,
        expireAt: values.expireAt ? values.expireAt.format('YYYY-MM-DD') : '',
        note: values.note || '',
      });
      if (res.success) {
        message.success(res.message || (editing ? '授权已调整' : '授权成功'));
        setModalOpen(false);
        loadGrants();
      } else {
        message.error(res.error || '保存失败');
      }
    } catch (e) {
      if (e.errorFields) return; // 表单校验错误，不提示
      message.error('保存失败: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 吊销
  const handleRevoke = async (row) => {
    try {
      const res = await assessmentGrant({ action: 'revoke', userId: row.userId });
      if (res.success) {
        message.success(res.message || '已吊销');
        loadGrants();
      } else {
        message.error(res.error || '吊销失败');
      }
    } catch (e) {
      message.error('吊销失败: ' + e.message);
    }
  };

  // 恢复
  const handleResume = async (row) => {
    try {
      const res = await assessmentGrant({ action: 'resume', userId: row.userId });
      if (res.success) {
        if (res.warning) {
          message.warning(res.warning);
        } else {
          message.success(res.message || '已恢复');
        }
        loadGrants();
      } else {
        message.error(res.error || '恢复失败');
      }
    } catch (e) {
      message.error('恢复失败: ' + e.message);
    }
  };

  const columns = [
    {
      title: '昵称',
      dataIndex: 'nickName',
      key: 'nickName',
      width: 140,
      render: (v) => v || '未命名用户',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (v) => v || '—',
    },
    {
      title: '授权状态',
      key: 'status',
      width: 150,
      render: (_, row) => renderStatusTag(row),
    },
    {
      title: '截止时间',
      key: 'expireAt',
      width: 120,
      render: (_, row) => {
        const ts = parseExpireTs(row.grant?.expireAt);
        return ts != null ? (
          <span>{new Date(ts).toLocaleDateString()}</span>
        ) : (
          <span style={{ color: '#8E8E93' }}>{row.grant ? '长期有效' : '—'}</span>
        );
      },
    },
    {
      title: '备注',
      key: 'note',
      ellipsis: true,
      render: (_, row) => row.grant?.note || '—',
    },
    {
      title: '操作',
      key: 'action',
      width: 190,
      render: (_, row) => {
        if (!row.grant) {
          return (
            <Button type="primary" size="small" onClick={openCreate}>
              授权
            </Button>
          );
        }
        return (
          <Space size={4}>
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openEdit(row)}>
              调整
            </Button>
            {row.grant.status === 'revoked' ? (
              <Button type="link" size="small" style={{ padding: 0 }} onClick={() => handleResume(row)}>
                恢复
              </Button>
            ) : (
              <Button type="link" size="small" danger style={{ padding: 0 }} onClick={() => handleRevoke(row)}>
                吊销
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">测评授权</h2>
        <p className="page-desc">管理学生的智能测评使用授权</p>
      </div>

      {/* 统计卡 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="已授权总数"
              value={stats.total}
              prefix={<span className="stat-icon"><TeamOutlined /></span>}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="有效授权"
              value={stats.active}
              prefix={<span className="stat-icon"><SafetyOutlined /></span>}
              valueStyle={{ color: '#12B7A8' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="剩余总次数"
              value={stats.remainingTotal}
              prefix={<span className="stat-icon"><ThunderboltOutlined /></span>}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="7天内到期"
              value={stats.expiringSoon}
              prefix={<span className="stat-icon"><ClockCircleOutlined /></span>}
              valueStyle={{ color: stats.expiringSoon > 0 ? '#FF9500' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {/* 学生授权表格 */}
      <Card
        title="学生授权列表"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadGrants}>
            刷新
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey="userId"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `共 ${t} 人` }}
          size="middle"
          locale={{
            emptyText: <Empty description="暂无学生数据" />,
          }}
        />
      </Card>

      {/* 授权 / 调整弹窗 */}
      <Modal
        title={editing ? `调整授权 · ${editing.nickName || '未命名用户'}` : '新增授权'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          {!editing && (
            <Form.Item
              name="userId"
              label="学生"
              rules={[{ required: true, message: '请选择学生' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="选择学生"
                options={(students || []).map((s) => ({
                  value: s.userId,
                  label: `${s.nickName || '未命名用户'}${s.phone ? `（${s.phone}）` : ''}`,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item
            name="totalQuota"
            label="使用次数"
            rules={[{ required: true, message: '请输入可用测评次数' }]}
          >
            <InputNumber min={1} precision={0} addonAfter="次" style={{ width: '100%' }} placeholder="可用测评次数" />
          </Form.Item>
          <Form.Item name="expireAt" label="截止日期">
            <DatePicker style={{ width: '100%' }} allowClear placeholder="不填则长期有效" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input placeholder="选填" maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
