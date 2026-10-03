import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Segmented,
  DatePicker,
  Select,
  Space,
  Modal,
  Form,
  Input,
  TimePicker,
  Switch,
  Checkbox,
  Popconfirm,
  Calendar,
  Tooltip,
  message,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CustomerServiceOutlined,
  BookOutlined,
  EditOutlined,
  AudioOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getCourses, saveCourse, deleteCourse, getAllUsers } from '../../api';

const SUBJECTS = ['听力', '阅读', '写作', '口语'];

// 科目图标：与小程序 schedule-manage 页一致（headphones / book / pen / mic）
const SUBJECT_ICONS = {
  听力: <CustomerServiceOutlined />,
  阅读: <BookOutlined />,
  写作: <EditOutlined />,
  口语: <AudioOutlined />,
};
// 月历 chip 的科目样式类名
const SUBJECT_CHIP_CLASS = { 听力: 'listening', 阅读: 'reading', 写作: 'writing', 口语: 'speaking' };
// 每个日期格子最多直接展示的课程条数，超出折叠为「+N 更多」
const MAX_CELL_CHIPS = 3;
const WEEKDAYS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 },
];

export default function Schedule() {
  const [viewMode, setViewMode] = useState('day'); // day | week | month
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState([]);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [recurring, setRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // 计算日期范围
  const dateRange = useMemo(() => {
    let start, end;
    if (viewMode === 'day') {
      start = selectedDate;
      end = selectedDate;
    } else if (viewMode === 'week') {
      start = selectedDate.subtract(selectedDate.day(), 'day');
      end = start.add(6, 'day');
    } else {
      // 月视图按日历网格取数：周一为一周起始，覆盖整屏 6 行 × 7 天，
      // 使网格边缘带出的相邻月份日期也能显示课程
      const first = selectedDate.startOf('month');
      const offset = (first.day() + 6) % 7;
      start = first.subtract(offset, 'day');
      end = start.add(41, 'day');
    }
    return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') };
  }, [viewMode, selectedDate]);

  const loadStudents = useCallback(async () => {
    try {
      const res = await getAllUsers({});
      if (res.success) {
        setStudents((res.data || []).map((u) => ({ value: u._id, label: u.nickName || '未命名用户' })));
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCourses({ startDate: dateRange.start, endDate: dateRange.end, limit: 500 });
      if (res.success) {
        setList(res.data || []);
      } else {
        message.error(res.error || '加载排课失败');
      }
    } catch (e) {
      message.error(e.message || '加载排课失败');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const filteredList = useMemo(() => {
    if (!studentId) return list;
    return list.filter((c) => c.studentId === studentId);
  }, [list, studentId]);

  // 月视图：按日期 YYYY-MM-DD 分组（列表已按日期/开始时间排序，分组内顺序保持不变）
  const coursesByDate = useMemo(() => {
    const map = {};
    filteredList.forEach((c) => {
      const key = (c.date || '').substring(0, 10);
      if (!key) return;
      (map[key] ||= []).push(c);
    });
    return map;
  }, [filteredList]);

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 110,
      render: (v) => (v || '').substring(0, 10),
    },
    {
      title: '时间',
      width: 110,
      render: (_, r) => `${r.startTime || ''} - ${r.endTime || ''}`,
    },
    {
      title: '科目',
      dataIndex: 'subject',
      width: 96,
      render: (v) => (
        <span className="subject-chip">
          {SUBJECT_ICONS[v] || null}
          {v}
        </span>
      ),
    },
    { title: '课程名称', dataIndex: 'title', ellipsis: true },
    { title: '学生', dataIndex: 'studentName', width: 100 },
    { title: '老师', dataIndex: 'teacher', width: 100 },
    { title: '地点', dataIndex: 'location', width: 120, render: (v) => v || '-' },
    {
      title: '操作',
      width: 130,
      render: (_, r) => (
        <Space>
          <Button size="small" type="link" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Popconfirm title="确认删除这节课？" onConfirm={() => handleDelete(r)}>
            <Button size="small" type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // presetDate：月历空白格快捷新增时预填日期（YYYY-MM-DD），默认今天
  const openAdd = (presetDate) => {
    setEditing(null);
    setRecurring(false);
    form.resetFields();
    form.setFieldsValue({
      subject: '听力',
      date: presetDate ? dayjs(presetDate) : dayjs(),
      startTime: dayjs('09:00', 'HH:mm'),
      endTime: dayjs('10:00', 'HH:mm'),
    });
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setRecurring(false);
    form.setFieldsValue({
      title: r.title,
      subject: r.subject || '听力',
      studentId: r.studentId,
      teacher: r.teacher,
      date: dayjs((r.date || '').substring(0, 10)),
      startTime: dayjs(r.startTime, 'HH:mm'),
      endTime: dayjs(r.endTime, 'HH:mm'),
      location: r.location,
      description: r.description,
    });
    setModalOpen(true);
  };

  const handleDelete = async (r) => {
    try {
      const res = await deleteCourse({ id: r._id });
      if (res.success) {
        message.success('已删除');
        loadCourses();
      } else {
        message.error(res.error || '删除失败');
      }
    } catch (e) {
      message.error(e.message || '删除失败');
    }
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const payload = {
      title: values.title,
      subject: values.subject,
      studentId: values.studentId || '',
      studentName: students.find((s) => s.value === values.studentId)?.label || '',
      teacher: values.teacher || '',
      date: values.date.format('YYYY-MM-DD'),
      startTime: values.startTime.format('HH:mm'),
      endTime: values.endTime.format('HH:mm'),
      location: values.location || '',
      description: values.description || '',
    };

    setSaving(true);
    try {
      const res = await saveCourse({
        action: editing ? 'update' : 'add',
        courseId: editing ? editing._id : null,
        course: payload,
        recurring: recurring
          ? {
              weekdays: values.weekdays || [],
              weekCount: values.weekCount || 4,
            }
          : null,
      });
      if (res.success) {
        message.success(res.message || '保存成功');
        setModalOpen(false);
        loadCourses();
      } else {
        message.error(res.error || '保存失败');
      }
    } catch (e) {
      message.error(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const rangeText = useMemo(() => {
    if (viewMode === 'day') return selectedDate.format('YYYY年M月D日');
    if (viewMode === 'week') return `${dateRange.start} ~ ${dateRange.end}`;
    return selectedDate.format('YYYY年M月');
  }, [viewMode, selectedDate, dateRange]);

  // 月历单个日期格：chip 点击编辑、空白点击新增、悬浮删除
  const renderMonthCell = (date) => {
    const dateStr = date.format('YYYY-MM-DD');
    const courses = coursesByDate[dateStr] || [];
    const inMonth = date.month() === selectedDate.month();
    const visible = courses.slice(0, MAX_CELL_CHIPS);
    const hiddenCount = courses.length - visible.length;

    return (
      <div
        className={`cal-cell-body${inMonth ? '' : ' cal-cell-body--muted'}`}
        onClick={() => openAdd(dateStr)}
      >
        {visible.map((c) => (
          <Tooltip
            key={c._id}
            placement="rightTop"
            title={
              <div className="cal-tip">
                <div>{`${c.startTime || ''} - ${c.endTime || ''} ${c.subject || ''} · ${c.title || ''}`}</div>
                {c.studentName && <div>学生：{c.studentName}</div>}
                {c.teacher && <div>老师：{c.teacher}</div>}
                {c.location && <div>地点：{c.location}</div>}
                {c.description && <div>备注：{c.description}</div>}
              </div>
            }
          >
            <div
              className={`cal-chip cal-chip--${SUBJECT_CHIP_CLASS[c.subject] || 'other'}`}
              onClick={(e) => {
                e.stopPropagation();
                openEdit(c);
              }}
            >
              <span className="cal-chip-time">{c.startTime}</span>
              <span className="cal-chip-subject">{c.subject}</span>
              <span className="cal-chip-title">{c.title}</span>
              <Popconfirm
                title="确认删除这节课？"
                onConfirm={() => handleDelete(c)}
              >
                <span
                  className="cal-chip-del"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DeleteOutlined />
                </span>
              </Popconfirm>
            </div>
          </Tooltip>
        ))}
        {hiddenCount > 0 && (
          <div
            className="cal-cell-more"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDate(date);
              setViewMode('day');
            }}
          >
            +{hiddenCount} 更多
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">排课管理</h2>
        <p className="page-desc">按日 / 周 / 月查看课程，支持单节与循环排课</p>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Segmented
              options={[
                { label: '日视图', value: 'day' },
                { label: '周视图', value: 'week' },
                { label: '月视图', value: 'month' },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
            <DatePicker
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              picker={viewMode === 'month' ? 'month' : viewMode === 'week' ? 'week' : 'date'}
              allowClear={false}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="按学生筛选"
              style={{ width: 180 }}
              value={studentId || undefined}
              onChange={(v) => setStudentId(v || '')}
              options={students}
            />
            <Button icon={<ReloadOutlined />} onClick={loadCourses}>
              刷新
            </Button>
          </Space>
          <Space>
            <span className="range-meta">{rangeText}（共 {filteredList.length} 节）</span>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              新增排课
            </Button>
          </Space>
        </Space>
      </Card>

      {viewMode === 'month' ? (
        <Card className="sched-calendar-card">
          <Calendar
            className="sched-calendar"
            fullscreen
            mode="month"
            value={selectedDate}
            headerRender={() => null}
            onSelect={(d) => setSelectedDate(d)}
            cellRender={(date, info) =>
              info.type === 'date' ? renderMonthCell(date) : null
            }
          />
        </Card>
      ) : (
        <Table
          rowKey="_id"
          loading={loading}
          columns={columns}
          dataSource={filteredList}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 节` }}
        />
      )}

      <Modal
        title={editing ? '编辑课程' : '新增排课'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="title" label="课程名称" rules={[{ required: true, message: '请输入课程名称' }]}>
            <Input placeholder="如：雅思听力精讲 L2" />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="subject" label="科目" rules={[{ required: true }]}>
              <Select style={{ width: 140 }} options={SUBJECTS.map((s) => ({ value: s, label: s }))} />
            </Form.Item>
            <Form.Item name="studentId" label="学生">
              <Select style={{ width: 200 }} allowClear showSearch optionFilterProp="label" placeholder="选择学生" options={students} />
            </Form.Item>
          </Space>
          <Space size="large" wrap>
            <Form.Item name="teacher" label="老师">
              <Input placeholder="老师姓名" style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="date" label="日期" rules={[{ required: true }]}>
              <DatePicker />
            </Form.Item>
            <Form.Item name="startTime" label="开始时间" rules={[{ required: true }]}>
              <TimePicker format="HH:mm" />
            </Form.Item>
            <Form.Item name="endTime" label="结束时间" rules={[{ required: true }]}>
              <TimePicker format="HH:mm" />
            </Form.Item>
          </Space>
          <Form.Item name="location" label="地点">
            <Input placeholder="上课地点 / 线上会议号" />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input.TextArea rows={2} placeholder="课程说明、作业要求等" />
          </Form.Item>

          {!editing && (
            <>
              <Form.Item label="循环排课">
                <Switch checked={recurring} onChange={setRecurring} />
              </Form.Item>
              {recurring && (
                <>
                  <Form.Item name="weekdays" label="重复星期" rules={[{ required: true, message: '请选择星期' }]}>
                    <Checkbox.Group options={WEEKDAYS} />
                  </Form.Item>
                  <Form.Item name="weekCount" label="重复周数" initialValue={4}>
                    <Input type="number" min={1} max={52} style={{ width: 120 }} addonAfter="周" />
                  </Form.Item>
                </>
              )}
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
