import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Table, Select, Tag, Empty, Segmented, message } from 'antd';
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

// 图表通用样式（与测评报告页一致）
const AXIS_LABEL = { color: '#8E8E93', fontSize: 11 };
const SPLIT_LINE = { lineStyle: { color: '#EFEFF2' } };
const TOOLTIP_CARD = {
  backgroundColor: '#FFFFFF',
  borderColor: '#E5E5EA',
  borderWidth: 1,
  textStyle: { color: '#1D1D1F', fontSize: 12 },
  extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-radius: 10px;',
};

const TREND_SERIES = [
  { key: 'visitors', name: '访问人数', color: '#0A84FF' },
  { key: 'logins', name: '登录次数', color: '#12B7A8' },
  { key: 'assessments', name: '测评次数', color: '#FF9500' },
  { key: 'checkins', name: '打卡人数', color: '#AF52DE' },
];

const GRANULARITY_OPTIONS = [
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
];

const GRANULARITY_TITLE = { day: '近 14 天', week: '近 12 周', month: '近 12 月' };

/** 柱状图 x 轴标签：day/week 用 M/D，month 用 M月 */
function axisLabelOf(label) {
  if (/^\d{4}-\d{2}$/.test(label)) return `${parseInt(label.split('-')[1], 10)}月`;
  const p = String(label).split('-');
  return p.length >= 3 ? `${parseInt(p[1], 10)}/${parseInt(p[2], 10)}` : label;
}

/** 趋势柱状图配置（日/周/月） */
function trendOption(granularity, trend) {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...TOOLTIP_CARD },
    legend: { bottom: 0, icon: 'circle', textStyle: { color: '#6E6E73', fontSize: 12 } },
    grid: { left: 40, right: 20, top: 20, bottom: 56 },
    xAxis: {
      type: 'category',
      data: (trend || []).map((t) => t.date),
      axisLabel: { ...AXIS_LABEL, interval: 'auto', formatter: axisLabelOf },
      axisLine: { lineStyle: { color: '#E5E5EA' } },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', minInterval: 1, axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    series: TREND_SERIES.map((s) => ({
      name: s.name,
      type: 'bar',
      barMaxWidth: 14,
      data: (trend || []).map((t) => t[s.key] || 0),
      itemStyle: { color: s.color, borderRadius: [3, 3, 0, 0] },
    })),
  };
}

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
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card">
            <Statistic
              title="总用户"
              value={ov.usersTotal || 0}
              prefix={<span className="stat-icon"><TeamOutlined /></span>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card">
            <Statistic
              title="今日活跃"
              value={ov.visitsToday || 0}
              prefix={<span className="stat-icon"><EyeOutlined /></span>}
              valueStyle={{ color: '#12B7A8' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card">
            <Statistic
              title="今日新增"
              value={ov.usersNewToday || 0}
              prefix={<span className="stat-icon"><UserAddOutlined /></span>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card">
            <Statistic
              title="今日测评"
              value={ov.assessmentsToday || 0}
              prefix={<span className="stat-icon"><FundOutlined /></span>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card">
            <Statistic
              title="今日打卡"
              value={ov.checkinsToday || 0}
              prefix={<span className="stat-icon"><CheckCircleOutlined /></span>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card">
            <Statistic
              title="今日管理操作"
              value={ov.auditToday || 0}
              prefix={<span className="stat-icon"><ControlOutlined /></span>}
            />
          </Card>
        </Col>
      </Row>

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
          <ReactECharts option={trendOption(granularity, trend)} style={{ height: 320 }} />
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
