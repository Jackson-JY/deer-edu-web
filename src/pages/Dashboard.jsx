import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Select, Tag, Empty, Segmented, message } from 'antd';
import {
  TeamOutlined,
  EyeOutlined,
  UserAddOutlined,
  FundOutlined,
  CheckCircleOutlined,
  ControlOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { adminDashboard } from '../api';
import { barTrendOption, GRANULARITY_OPTIONS, GRANULARITY_TITLE } from '../utils/charts';
import StatCards from '../components/StatCards';

const TREND_SERIES = [
  { key: 'visitors', name: '访问人数', color: '#0A84FF' },
  { key: 'logins', name: '登录次数', color: '#12B7A8' },
  { key: 'assessments', name: '测评次数', color: '#FF9500' },
  { key: 'checkins', name: '打卡人数', color: '#AF52DE' },
];

const MODULE_OPTIONS = [
  { label: '全部模块', value: '' },
  { label: '课程 course', value: 'course' },
  { label: '打卡 checkin', value: 'checkin' },
  { label: '测评授权 assessment_grant', value: 'assessment_grant' },
];

const ACCESS_TYPE_OPTIONS = [
  { label: '全部类型', value: '' },
  { label: '登录', value: 'login' },
  { label: '测评', value: 'assessment' },
];

export default function Dashboard() {
  // 概览
  const [overview, setOverview] = useState(null);
  // 趋势
  const [granularity, setGranularity] = useState('day');
  const [trend, setTrend] = useState([]);

  // 管理员操作记录
  const [auditList, setAuditList] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditModule, setAuditModule] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);

  // 用户访问记录
  const [accessList, setAccessList] = useState([]);
  const [accessTotal, setAccessTotal] = useState(0);
  const [accessPage, setAccessPage] = useState(1);
  const [accessType, setAccessType] = useState('');
  const [accessLoading, setAccessLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const res = await adminDashboard({ action: 'overview' });
      if (res.success) {
        setOverview(res.overview || null);
      } else {
        message.error(res.error || '加载统计数据失败');
      }
    } catch (e) {
      message.error('加载统计数据失败: ' + e.message);
    }
  }, []);

  const loadTrend = useCallback(async (gran) => {
    try {
      const res = await adminDashboard({ action: 'trend', granularity: gran });
      if (res.success) {
        setTrend(res.trend || []);
      } else {
        message.error(res.error || '加载趋势数据失败');
      }
    } catch (e) {
      message.error('加载趋势数据失败: ' + e.message);
    }
  }, []);

  const loadAuditLogs = useCallback(async (page, module) => {
    setAuditLoading(true);
    try {
      const res = await adminDashboard({
        action: 'auditLogs',
        page,
        pageSize: 20,
        module: module || undefined,
      });
      if (res.success) {
        setAuditList(res.list || []);
        setAuditTotal(res.total || 0);
      } else {
        message.error(res.error || '加载操作记录失败');
      }
    } catch (e) {
      message.error('加载操作记录失败: ' + e.message);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const loadAccessLogs = useCallback(async (page, type) => {
    setAccessLoading(true);
    try {
      const res = await adminDashboard({
        action: 'accessLogs',
        page,
        pageSize: 20,
        type: type || undefined,
      });
      if (res.success) {
        setAccessList(res.list || []);
        setAccessTotal(res.total || 0);
      } else {
        message.error(res.error || '加载访问记录失败');
      }
    } catch (e) {
      message.error('加载访问记录失败: ' + e.message);
    } finally {
      setAccessLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    loadTrend('day');
  }, [loadOverview, loadTrend]);

  useEffect(() => {
    loadAuditLogs(auditPage, auditModule);
  }, [auditPage, auditModule, loadAuditLogs]);

  useEffect(() => {
    loadAccessLogs(accessPage, accessType);
  }, [accessPage, accessType, loadAccessLogs]);

  const auditColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v) => (v ? new Date(v).toLocaleString() : '—'),
    },
    { title: '管理员', dataIndex: 'adminName', key: 'adminName', width: 110, render: (v) => v || '—' },
    { title: '操作', dataIndex: 'action', key: 'action', width: 140 },
    { title: '模块', dataIndex: 'module', key: 'module', width: 150 },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (v) => v || '—',
    },
  ];

  const accessColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v) => (v ? new Date(v).toLocaleString() : '—'),
    },
    {
      title: '用户',
      dataIndex: 'nickName',
      key: 'nickName',
      width: 130,
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
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (v) =>
        v === 'login' ? <Tag color="blue">登录</Tag> : v === 'assessment' ? <Tag color="green">测评</Tag> : <Tag>{v || '—'}</Tag>,
    },
    {
      title: '说明',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (v) => v || '—',
    },
  ];

  const ov = overview || {};

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">数据看板</h2>
        <p className="page-desc">平台运营数据概览与近期趋势</p>
      </div>

      {/* 指标卡 */}
      <StatCards
        items={[
          { title: '总用户', value: ov.usersTotal, icon: <TeamOutlined /> },
          { title: '今日活跃', value: ov.visitsToday, icon: <EyeOutlined />, color: '#12B7A8' },
          { title: '今日新增', value: ov.usersNewToday, icon: <UserAddOutlined /> },
          { title: '今日测评', value: ov.assessmentsToday, icon: <FundOutlined /> },
          { title: '今日打卡', value: ov.checkinsToday, icon: <CheckCircleOutlined /> },
          { title: '今日管理操作', value: ov.auditToday, icon: <ControlOutlined /> },
        ]}
      />

      {/* 趋势（日/周/月 柱状图） */}
      <Card
        title={`${GRANULARITY_TITLE[granularity]}趋势`}
        extra={
          <Segmented
            options={GRANULARITY_OPTIONS}
            value={granularity}
            onChange={(v) => {
              setGranularity(v);
              loadTrend(v);
            }}
          />
        }
        style={{ marginBottom: 16 }}
      >
        {trend.length ? (
          <ReactECharts
            option={barTrendOption({
              dates: trend.map((t) => t.date),
              series: TREND_SERIES.map((s) => ({ name: s.name, data: trend.map((t) => t[s.key] || 0), color: s.color })),
            })}
            style={{ height: 320 }}
          />
        ) : (
          <Empty description="暂无趋势数据" style={{ padding: '40px 0' }} />
        )}
      </Card>

      {/* 管理员操作记录 */}
      <Card
        title="管理员操作记录"
        extra={
          <Select
            value={auditModule}
            onChange={(v) => {
              setAuditModule(v);
              setAuditPage(1);
            }}
            options={MODULE_OPTIONS}
            style={{ width: 220 }}
          />
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          columns={auditColumns}
          dataSource={auditList}
          rowKey="_id"
          loading={auditLoading}
          size="middle"
          pagination={{
            current: auditPage,
            pageSize: 20,
            total: auditTotal,
            showSizeChanger: false,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => setAuditPage(p),
          }}
          locale={{
            emptyText: <Empty description="暂无操作记录" />,
          }}
        />
      </Card>

      {/* 用户访问记录 */}
      <Card
        title="用户访问记录"
        extra={
          <Select
            value={accessType}
            onChange={(v) => {
              setAccessType(v);
              setAccessPage(1);
            }}
            options={ACCESS_TYPE_OPTIONS}
            style={{ width: 160 }}
          />
        }
      >
        <Table
          columns={accessColumns}
          dataSource={accessList}
          rowKey="_id"
          loading={accessLoading}
          size="middle"
          pagination={{
            current: accessPage,
            pageSize: 20,
            total: accessTotal,
            showSizeChanger: false,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => setAccessPage(p),
          }}
          locale={{
            emptyText: <Empty description="暂无访问记录" />,
          }}
        />
      </Card>
    </div>
  );
}
