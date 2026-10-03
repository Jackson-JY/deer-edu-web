import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Row, Col, Statistic, Button, Space, Avatar, Drawer, message, Empty } from 'antd';
import { UserOutlined, UserAddOutlined, FireOutlined, FileTextOutlined, BarChartOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { adminStats } from '../../api';
import { getTempFileURL } from '../../cloudbase';

/**
 * 批量将学生列表中的 cloud:// 头像 fileID 转为 HTTPS 临时链接
 * 浏览器不识别 cloud:// 协议，必须转换后才能渲染
 */
async function resolveAvatars(students) {
  const cloudIds = students
    .map((s) => s.avatarUrl)
    .filter((url) => url && typeof url === 'string' && url.startsWith('cloud://'));
  if (!cloudIds.length) return students;

  const urls = await getTempFileURL([...new Set(cloudIds)]);
  const idToUrl = new Map(cloudIds.map((id, i) => [id, urls[i]]));
  return students.map((s) => ({
    ...s,
    avatarUrl: s.avatarUrl && idToUrl.get(s.avatarUrl) ? idToUrl.get(s.avatarUrl) : s.avatarUrl,
  }));
}

// 图表配色：品牌薄荷 + Apple 系统色
const AXIS_LABEL = { color: '#8E8E93', fontSize: 11 };
const SPLIT_LINE = { lineStyle: { color: '#EFEFF2' } };
const CHART_TOOLTIP = {
  trigger: 'axis',
  backgroundColor: '#FFFFFF',
  borderColor: '#E5E5EA',
  borderWidth: 1,
  textStyle: { color: '#1D1D1F', fontSize: 12 },
  extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-radius: 10px;',
};

const trendChartOption = (data) => {
  const dates = data.map((d) => d.date);
  const buildSeries = (name, key, color) => ({
    name,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    data: data.map((d) => d[key]),
    itemStyle: { color },
    lineStyle: { width: 2.5 },
    areaStyle: {
      color: {
        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: `${color}26` },
          { offset: 1, color: `${color}00` },
        ],
      },
    },
  });
  return {
    color: ['#12B7A8', '#FF9500', '#AF52DE'],
    tooltip: CHART_TOOLTIP,
    legend: { data: ['打卡次数', '作业提交', '考试成绩'], bottom: 0, textStyle: { color: '#6E6E73' }, icon: 'circle' },
    grid: { left: 36, right: 20, top: 24, bottom: 40 },
    xAxis: { type: 'category', data: dates, axisLabel: AXIS_LABEL, axisLine: { lineStyle: { color: '#E5E5EA' } }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE, minInterval: 1 },
    series: [
      buildSeries('打卡次数', 'checkins', '#12B7A8'),
      buildSeries('作业提交', 'homework', '#FF9500'),
      buildSeries('考试成绩', 'exams', '#AF52DE'),
    ],
  };
};

export default function Students() {
  const [overview, setOverview] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailStudent, setDetailStudent] = useState(null);
  const [trend, setTrend] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminStats({ action: 'overview' });
      if (res.success) {
        setOverview(res.overview || null);
        const list = await resolveAvatars(res.students || []);
        setStudents(list);
      } else {
        message.error(res.error || '加载失败');
      }
    } catch (e) {
      message.error(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const openDetail = async (student) => {
    setDetailStudent(student);
    setTrend([]);
    setTrendLoading(true);
    try {
      const res = await adminStats({ action: 'trend', studentId: student._id });
      if (res.success) {
        setTrend(res.trend || []);
      }
    } catch (e) {
      /* ignore */
    } finally {
      setTrendLoading(false);
    }
  };

  const columns = [
    {
      title: '学生',
      dataIndex: 'nickName',
      render: (v, r) => (
        <Space>
          <Avatar size="small" src={r.avatarUrl} icon={<UserOutlined />} />
          <span>{v || '未命名用户'}</span>
        </Space>
      ),
    },
    { title: '注册时间', dataIndex: '_createTime', width: 160, render: (v) => (v ? new Date(v).toLocaleDateString('zh-CN') : '-') },
    { title: '打卡', dataIndex: 'checkinCount', width: 70 },
    { title: '作业', dataIndex: 'homeworkCount', width: 70 },
    { title: '考试', dataIndex: 'examCount', width: 70 },
    {
      title: '最近活跃',
      dataIndex: 'lastActive',
      width: 140,
      render: (v) => (v ? new Date(v).toLocaleDateString('zh-CN') : '—'),
    },
    {
      title: '操作',
      width: 100,
      render: (_, r) => (
        <Button size="small" type="link" onClick={() => openDetail(r)}>
          分析
        </Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">学生数据分析</h2>
        <p className="page-desc">学员规模、学习行为与活跃度概览</p>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic title="学生总数" value={overview?.totalStudents || 0} prefix={<span className="stat-icon"><UserOutlined /></span>} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic title="本周活跃" value={overview?.activeThisWeek || 0} prefix={<span className="stat-icon"><FireOutlined /></span>} valueStyle={{ color: '#0E8C81' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic title="本月新增" value={overview?.newThisMonth || 0} prefix={<span className="stat-icon"><UserAddOutlined /></span>} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic title="累计作业" value={overview?.totalHomework || 0} prefix={<span className="stat-icon"><FileTextOutlined /></span>} />
          </Card>
        </Col>
      </Row>

      <Table rowKey="_id" loading={loading} columns={columns} dataSource={students} pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 名学生` }} />

      <Drawer
        title={detailStudent?.nickName || '学生详情'}
        open={!!detailStudent}
        onClose={() => setDetailStudent(null)}
        width={640}
      >
        {trendLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <BarChartOutlined spin style={{ fontSize: 28, color: '#12B7A8' }} />
          </div>
        ) : trend.length ? (
          <ReactECharts option={trendChartOption(trend)} style={{ height: 360 }} />
        ) : (
          <Empty description="暂无学习行为数据" />
        )}
      </Drawer>
    </div>
  );
}
