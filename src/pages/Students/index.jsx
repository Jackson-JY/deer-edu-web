import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Avatar,
  Drawer,
  Tag,
  Select,
  Input,
  Checkbox,
  Popconfirm,
  Empty,
  Segmented,
  message,
} from 'antd';
import {
  UserOutlined,
  UserAddOutlined,
  FireOutlined,
  FileTextOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { adminStats, manageClasses } from '../../api';
import { getTempFileURL } from '../../cloudbase';
import { barTrendOption, GRANULARITY_OPTIONS, GRANULARITY_TITLE } from '../../utils/charts';
import StatCards from '../../components/StatCards';

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

/** 单生学习行为柱状图（日/周/月） */
const trendChartOption = (data) =>
  barTrendOption({
    dates: data.map((d) => d.date),
    legend: { data: ['打卡次数', '作业提交', '考试成绩'], bottom: 0, textStyle: { color: '#6E6E73' }, icon: 'circle' },
    grid: { left: 36, right: 20, top: 24, bottom: 56 },
    series: [
      { name: '打卡次数', data: data.map((d) => d.checkins), color: '#12B7A8' },
      { name: '作业提交', data: data.map((d) => d.homework), color: '#FF9500' },
      { name: '考试成绩', data: data.map((d) => d.exams), color: '#AF52DE' },
    ],
  });

export default function Students() {
  const [overview, setOverview] = useState(null);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filterClass, setFilterClass] = useState('');
  const [loading, setLoading] = useState(false);

  // 学生详情抽屉
  const [detailStudent, setDetailStudent] = useState(null);
  const [trend, setTrend] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [granularity, setGranularity] = useState('day');

  // 班级管理抽屉
  const [classDrawerOpen, setClassDrawerOpen] = useState(false);
  const [classList, setClassList] = useState([]);
  const [classListLoading, setClassListLoading] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [renaming, setRenaming] = useState(null); // {classId, name}
  const [memberClass, setMemberClass] = useState(null); // 正在编辑成员的班级
  const [memberIds, setMemberIds] = useState([]);
  const [savingMembers, setSavingMembers] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminStats({ action: 'overview' });
      if (res.success) {
        setOverview(res.overview || null);
        setClasses(res.classes || []);
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
    setGranularity('day');
    setTrendLoading(true);
    try {
      const res = await adminStats({ action: 'trend', studentId: student._id, granularity: 'day' });
      if (res.success) {
        setTrend(res.trend || []);
      }
    } catch (e) {
      /* ignore */
    } finally {
      setTrendLoading(false);
    }
  };

  const changeGranularity = async (gran) => {
    setGranularity(gran);
    if (!detailStudent) return;
    setTrendLoading(true);
    try {
      const res = await adminStats({ action: 'trend', studentId: detailStudent._id, granularity: gran });
      if (res.success) setTrend(res.trend || []);
    } catch (e) {
      /* ignore */
    } finally {
      setTrendLoading(false);
    }
  };

  // ---------- 班级管理 ----------
  const loadClassList = useCallback(async () => {
    setClassListLoading(true);
    try {
      const res = await manageClasses({ action: 'list' });
      if (res.success) {
        setClassList(res.classes || []);
      } else {
        message.error(res.error || '加载班级失败');
      }
    } catch (e) {
      message.error('加载班级失败: ' + e.message);
    } finally {
      setClassListLoading(false);
    }
  }, []);

  const openClassDrawer = () => {
    setClassDrawerOpen(true);
    setMemberClass(null);
    setRenaming(null);
    loadClassList();
  };

  const handleCreateClass = async () => {
    const name = newClassName.trim();
    if (!name) return;
    try {
      const res = await manageClasses({ action: 'create', name });
      if (res.success) {
        message.success(res.message || '已创建');
        setNewClassName('');
        loadClassList();
        loadOverview();
      } else {
        message.error(res.error || '创建失败');
      }
    } catch (e) {
      message.error('创建失败: ' + e.message);
    }
  };

  const handleRename = async () => {
    if (!renaming || !renaming.name.trim()) return;
    try {
      const res = await manageClasses({ action: 'rename', classId: renaming.classId, name: renaming.name.trim() });
      if (res.success) {
        message.success(res.message || '已重命名');
        setRenaming(null);
        loadClassList();
        loadOverview();
      } else {
        message.error(res.error || '重命名失败');
      }
    } catch (e) {
      message.error('重命名失败: ' + e.message);
    }
  };

  const handleDeleteClass = async (cls) => {
    try {
      const res = await manageClasses({ action: 'delete', classId: cls._id });
      if (res.success) {
        message.success(res.message || '已删除');
        if (memberClass && memberClass._id === cls._id) setMemberClass(null);
        loadClassList();
        loadOverview();
      } else {
        message.error(res.error || '删除失败');
      }
    } catch (e) {
      message.error('删除失败: ' + e.message);
    }
  };

  const openMembers = (cls) => {
    setMemberClass(cls);
    // 从学生总表取该班当前成员
    const ids = students.filter((s) => (s.classIds || []).includes(cls._id)).map((s) => s._id);
    setMemberIds(ids);
  };

  const handleSaveMembers = async () => {
    if (!memberClass) return;
    setSavingMembers(true);
    try {
      const res = await manageClasses({ action: 'setStudents', classId: memberClass._id, userIds: memberIds });
      if (res.success) {
        message.success(res.message || '成员已更新');
        loadClassList();
        loadOverview();
      } else {
        message.error(res.error || '保存失败');
      }
    } catch (e) {
      message.error('保存失败: ' + e.message);
    } finally {
      setSavingMembers(false);
    }
  };

  // 按班级筛选
  const filteredStudents = useMemo(() => {
    if (!filterClass) return students;
    return students.filter((s) => (s.classIds || []).includes(filterClass));
  }, [students, filterClass]);

  const classIdToName = useMemo(() => {
    const m = {};
    classes.forEach((c) => {
      m[c._id] = c.name;
    });
    return m;
  }, [classes]);

  const renderClassTags = (record) => {
    const ids = record.classIds || [];
    if (!ids.length) return <span style={{ color: '#C7C7CC' }}>未分班</span>;
    return (
      <Space size={4} wrap>
        {ids.map((cid) => (
          <Tag key={cid} color="cyan" style={{ margin: 0 }}>
            {classIdToName[cid] || '已删班级'}
          </Tag>
        ))}
      </Space>
    );
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
    {
      title: '班级',
      key: 'classes',
      width: 200,
      render: (_, r) => renderClassTags(r),
    },
    { title: '注册时间', dataIndex: '_createTime', width: 120, render: (v) => (v ? new Date(v).toLocaleDateString('zh-CN') : '-') },
    { title: '打卡', dataIndex: 'checkinCount', width: 70 },
    { title: '作业', dataIndex: 'homeworkCount', width: 70 },
    { title: '考试', dataIndex: 'examCount', width: 70 },
    {
      title: '最近活跃',
      dataIndex: 'lastActive',
      width: 120,
      render: (v) => (v ? new Date(v).toLocaleDateString('zh-CN') : '—'),
    },
    {
      title: '操作',
      width: 90,
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
        <p className="page-desc">学员规模、班级层级、学习行为与活跃度概览</p>
      </div>

      <StatCards
        colProps={{ span: 6 }}
        items={[
          { title: '学生总数', value: overview?.totalStudents, icon: <UserOutlined /> },
          { title: '本周活跃', value: overview?.activeThisWeek, icon: <FireOutlined />, color: '#0E8C81' },
          { title: '本月新增', value: overview?.newThisMonth, icon: <UserAddOutlined /> },
          { title: '累计作业', value: overview?.totalHomework, icon: <FileTextOutlined /> },
        ]}
      />

      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
        <Space wrap>
          <Button type="primary" ghost icon={<AppstoreOutlined />} onClick={openClassDrawer}>
            班级管理
          </Button>
          <span style={{ color: '#8E8E93', fontSize: 13 }}>按班级筛选：</span>
          <Select
            allowClear
            placeholder="全部班级"
            style={{ width: 200 }}
            value={filterClass || undefined}
            onChange={(v) => setFilterClass(v || '')}
            options={classes.map((c) => ({ label: `${c.name}（${c.studentCount}）`, value: c._id }))}
          />
        </Space>
      </Card>

      <Table
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={filteredStudents}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 名学生` }}
      />

      {/* 学生详情抽屉 */}
      <Drawer
        title={detailStudent?.nickName || '学生详情'}
        open={!!detailStudent}
        onClose={() => setDetailStudent(null)}
        width={640}
      >
        {detailStudent && (
          <div style={{ marginBottom: 12 }}>
            <span style={{ color: '#8E8E93', fontSize: 13, marginRight: 8 }}>所属班级：</span>
            {(detailStudent.classIds || []).length ? (
              (detailStudent.classIds || []).map((cid) => (
                <Tag key={cid} color="cyan">{classIdToName[cid] || '已删班级'}</Tag>
              ))
            ) : (
              <span style={{ color: '#C7C7CC' }}>未分班</span>
            )}
          </div>
        )}
        <Segmented
          options={GRANULARITY_OPTIONS}
          value={granularity}
          onChange={changeGranularity}
          style={{ marginBottom: 12 }}
        />
        {trendLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <BarChartOutlined spin style={{ fontSize: 28, color: '#12B7A8' }} />
          </div>
        ) : trend.length ? (
          <>
            <div style={{ color: '#8E8E93', fontSize: 12, marginBottom: 4 }}>
              {GRANULARITY_TITLE[granularity]} · 学习行为统计
            </div>
            <ReactECharts option={trendChartOption(trend)} style={{ height: 360 }} />
          </>
        ) : (
          <Empty description="暂无学习行为数据" />
        )}
      </Drawer>

      {/* 班级管理抽屉 */}
      <Drawer title="班级管理" open={classDrawerOpen} onClose={() => setClassDrawerOpen(false)} width={520}>
        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
          <Input
            placeholder="输入班级名称（最多 20 字）"
            value={newClassName}
            maxLength={20}
            onChange={(e) => setNewClassName(e.target.value)}
            onPressEnter={handleCreateClass}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateClass}>
            新建班级
          </Button>
        </Space.Compact>

        {classList.length === 0 && !classListLoading && (
          <Empty description="还没有班级，先创建一个" style={{ padding: '24px 0' }} />
        )}

        {classList.map((cls) => (
          <Card
            key={cls._id}
            size="small"
            style={{ marginBottom: 8 }}
            title={
              renaming && renaming.classId === cls._id ? (
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    size="small"
                    value={renaming.name}
                    maxLength={20}
                    onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                    onPressEnter={handleRename}
                  />
                  <Button size="small" type="primary" onClick={handleRename}>
                    保存
                  </Button>
                  <Button size="small" onClick={() => setRenaming(null)}>
                    取消
                  </Button>
                </Space.Compact>
              ) : (
                <Space>
                  <TeamOutlined style={{ color: '#12B7A8' }} />
                  <span>{cls.name}</span>
                  <Tag>{cls.studentCount} 人</Tag>
                </Space>
              )
            }
            extra={
              renaming && renaming.classId === cls._id ? null : (
                <Space size={0}>
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openMembers(cls)}>
                    成员
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0 }}
                    icon={<EditOutlined />}
                    onClick={() => setRenaming({ classId: cls._id, name: cls.name })}
                  >
                    改名
                  </Button>
                  <Popconfirm
                    title={`删除「${cls.name}」？`}
                    description="将自动解绑班内全部学生"
                    okText="删除"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleDeleteClass(cls)}
                  >
                    <Button type="link" size="small" danger style={{ padding: 0 }} icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              )
            }
          >
            {memberClass && memberClass._id === cls._id && (
              <div>
                <Checkbox.Group
                  style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}
                  value={memberIds}
                  onChange={setMemberIds}
                >
                  {students.map((s) => (
                    <Checkbox key={s._id} value={s._id}>
                      <Space size={6}>
                        <Avatar size={18} src={s.avatarUrl} icon={<UserOutlined />} />
                        <span style={{ fontSize: 13 }}>{s.nickName || '未命名用户'}</span>
                      </Space>
                    </Checkbox>
                  ))}
                </Checkbox.Group>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <Button type="primary" size="small" loading={savingMembers} onClick={handleSaveMembers}>
                    保存成员
                  </Button>
                  <Button size="small" onClick={() => setMemberClass(null)}>
                    取消
                  </Button>
                  <span style={{ color: '#8E8E93', fontSize: 12, alignSelf: 'center' }}>
                    已选 {memberIds.length} 人；一名学生可属于多个班级
                  </span>
                </div>
              </div>
            )}
            {(!memberClass || memberClass._id !== cls._id) && (
              <div style={{ color: '#8E8E93', fontSize: 12 }}>
                点击「成员」勾选该班学生；学生可同时属于多个班级
              </div>
            )}
          </Card>
        ))}
      </Drawer>
    </div>
  );
}
