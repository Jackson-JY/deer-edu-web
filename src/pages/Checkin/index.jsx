import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  DatePicker,
  Select,
  AutoComplete,
  Form,
  Input,
  InputNumber,
  Space,
  Table,
  Spin,
  Empty,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  ReloadOutlined,
  TrophyOutlined,
  FireOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getDailyTasks, saveDailyTask, adminStats, manageClasses } from '../../api';

const { RangePicker } = DatePicker;

// 「新建一组」模式的 key（区别于任务组真实 classKey，''=全体）
const NEW_GROUP_KEY = '__new__';

// 预设科目快捷选项（也可自定义输入任意 ≤4 字的标签，如「单词」「泛读」）
const SUBJECT_OPTIONS = [
  { label: '听力', value: '听力' },
  { label: '阅读', value: '阅读' },
  { label: '写作', value: '写作' },
  { label: '口语', value: '口语' },
];

// 预设科目颜色（自定义标签统一用灰色兜底）
const SUBJECT_COLOR = {
  听力: '#5AC8FA',
  口语: '#FF9500',
  阅读: '#34C759',
  写作: '#AF52DE',
};

// 历史数据兼容：英文 key → 中文标签
const LEGACY_SUBJECT_MAP = {
  listening: '听力',
  reading: '阅读',
  writing: '写作',
  speaking: '口语',
};
const normalizeSubject = (s) => LEGACY_SUBJECT_MAP[s] || s || '听力';

/** 获取周一的日期 */
function getMonday(d) {
  const date = dayjs(d);
  const day = date.day(); // 0=Sunday, 1=Monday...
  const diff = day === 0 ? -6 : 1 - day;
  return date.add(diff, 'day');
}

/** 格式化日期 YYYY-MM-DD */
function fmtDate(d) {
  return d.format('YYYY-MM-DD');
}

export default function Checkin() {
  const [form] = Form.useForm();
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 周榜
  const [weekRange, setWeekRange] = useState([getMonday(dayjs()), getMonday(dayjs()).add(6, 'day')]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekRows, setWeekRows] = useState([]);

  // 班级（发布对象）
  const [classes, setClasses] = useState([]);

  // 当日任务组（支持同日多组：全体/班级各一组）
  const [dayTasks, setDayTasks] = useState([]);
  const [activeKey, setActiveKey] = useState(NEW_GROUP_KEY); // 当前编辑组：''=全体，classKey，NEW_GROUP_KEY=新建

  const classIdToName = useMemo(() => {
    const m = {};
    classes.forEach((c) => {
      m[c._id] = c.name;
    });
    return m;
  }, [classes]);

  /** 发布对象标签：[] = 全体学生 */
  const groupLabel = useCallback(
    (classIds) => {
      if (!classIds || classIds.length === 0) return '全体学生';
      return classIds.map((cid) => classIdToName[cid] || '未知班级').join('、');
    },
    [classIdToName]
  );

  // 加载班级列表（发布对象选择用）
  const loadClasses = useCallback(async () => {
    try {
      const res = await manageClasses({ action: 'list' });
      if (res.success) setClasses(res.classes || []);
    } catch (e) {
      // 静默失败：班级列表仅辅助选择
    }
  }, []);

  // 把某个任务组（或空）填入表单
  const fillForm = (task) => {
    if (task) {
      const items = (task.items || []).map((it) => ({
        id: it.id,
        subject: normalizeSubject(it.subject),
        content: it.content,
        suggestMinutes: it.suggestMinutes,
      }));
      form.setFieldsValue({
        classIds: Array.isArray(task.classIds) ? task.classIds : [],
        items: items.length ? items : [{}],
      });
    } else {
      form.setFieldsValue({ classIds: [], items: [{}] });
    }
  };

  // 加载指定日期的全部任务组，默认编辑第一组（preferKey 优先）
  const loadTask = useCallback(
    async (date, preferKey) => {
      setLoading(true);
      try {
        const res = await getDailyTasks({ action: 'getByDate', date: fmtDate(date) });
        const tasks = res.success ? res.tasks || [] : [];
        setDayTasks(tasks);
        let pick = null;
        if (preferKey !== undefined) {
          pick = tasks.find((t) => t.classKey === preferKey) || null;
        }
        if (!pick && tasks.length) pick = tasks[0];
        setActiveKey(pick ? pick.classKey : NEW_GROUP_KEY);
        fillForm(pick);
      } catch (e) {
        message.error('加载任务失败: ' + e.message);
        setDayTasks([]);
        setActiveKey(NEW_GROUP_KEY);
        form.setFieldsValue({ classIds: [], items: [{}] });
      } finally {
        setLoading(false);
      }
    },
    [form]
  );

  // 加载历史记录（复制用）
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await getDailyTasks({ action: 'getHistory', limit: 14 });
      if (res.success) {
        setHistoryList(res.history || []);
      }
    } catch (e) {
      // 静默失败，历史记录是辅助功能
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // 加载周榜
  const loadWeekStats = useCallback(async (range) => {
    setWeekLoading(true);
    try {
      const res = await adminStats({
        action: 'checkinWeekly',
        weekStart: fmtDate(range[0]),
        weekEnd: fmtDate(range[1]),
      });
      if (res.success) {
        setWeekRows(res.rows || []);
      } else {
        setWeekRows([]);
      }
    } catch (e) {
      message.error('加载周榜失败: ' + e.message);
      setWeekRows([]);
    } finally {
      setWeekLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTask(selectedDate);
  }, [selectedDate, loadTask]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    loadHistory();
    loadWeekStats(weekRange);
  }, [loadHistory, loadWeekStats, weekRange]);

  // 切换编辑的任务组
  const switchGroup = (key) => {
    if (key === activeKey) return;
    setActiveKey(key);
    const t = key === NEW_GROUP_KEY ? null : dayTasks.find((x) => x.classKey === key) || null;
    fillForm(t);
  };

  // 保存任务（按发布对象 upsert：classIds 空=全体）
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const items = (values.items || []).filter((it) => it && it.content && it.content.trim());
      if (items.length === 0) {
        message.warning('至少需要一项任务内容');
        return;
      }
      const classIds = values.classIds || [];
      setSaving(true);
      const res = await saveDailyTask({
        action: 'save',
        date: fmtDate(selectedDate),
        classIds,
        items: items.map((it, i) => ({
          id: it.id || `t${i + 1}`,
          subject: (it.subject || '听力').trim().slice(0, 4),
          content: it.content.trim(),
          suggestMinutes: it.suggestMinutes || 30,
        })),
      });
      if (res.success) {
        message.success(
          `${res.message || '已保存'}（${groupLabel(classIds)}可见）`
        );
        const savedKey = classIds.slice().sort().join(',');
        loadTask(selectedDate, savedKey); // 刷新任务组并定位到刚保存的一组
        loadHistory(); // 刷新历史
      } else {
        message.error(res.error || '保存失败');
      }
    } catch (e) {
      if (e.errorFields) return; // 表单校验错误，不提示
      message.error('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // 复制昨日（取昨日第一组任务的 items，发布对象以当前表单为准）
  const handleCopyYesterday = async () => {
    const yesterday = selectedDate.subtract(1, 'day');
    try {
      const res = await getDailyTasks({ action: 'getByDate', date: fmtDate(yesterday) });
      const src = (res.success && res.task) || (res.success && res.tasks && res.tasks[0]) || null;
      if (src) {
        const items = (src.items || []).map((it) => ({
          id: `t${Date.now()}_${Math.random()}`,
          subject: normalizeSubject(it.subject),
          content: it.content,
          suggestMinutes: it.suggestMinutes,
        }));
        form.setFieldsValue({ items: items.length ? items : [{}] });
        message.success(
          `已复制 ${fmtDate(yesterday)}（${groupLabel(src.classIds)}）的 ${items.length} 项任务`
        );
      } else {
        message.info(`${fmtDate(yesterday)} 没有已发布任务`);
      }
    } catch (e) {
      message.error('复制失败: ' + e.message);
    }
  };

  // 从历史记录复制
  const handleCopyFromHistory = async (dateStr) => {
    if (!dateStr) return;
    try {
      const res = await getDailyTasks({ action: 'getByDate', date: dateStr });
      const src = (res.success && res.task) || (res.success && res.tasks && res.tasks[0]) || null;
      if (src) {
        const items = (src.items || []).map((it) => ({
          id: `t${Date.now()}_${Math.random()}`,
          subject: normalizeSubject(it.subject),
          content: it.content,
          suggestMinutes: it.suggestMinutes,
        }));
        form.setFieldsValue({ items: items.length ? items : [{}] });
        message.success(`已复制 ${dateStr}（${groupLabel(src.classIds)}）的 ${items.length} 项任务`);
      } else {
        message.info(`${dateStr} 没有任务`);
      }
    } catch (e) {
      message.error('复制失败: ' + e.message);
    }
  };

  // 建议总时长（定时检测表单变化）
  const [totalMin, setTotalMin] = useState(0);
  useEffect(() => {
    const update = () => {
      const items = form.getFieldValue('items') || [];
      const t = items.reduce(
        (sum, it) => sum + (it && it.suggestMinutes ? Number(it.suggestMinutes) : 0),
        0
      );
      setTotalMin(t);
    };
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [form]);

  // 生成表彰文案
  const generatePraiseText = () => {
    if (weekRows.length === 0) {
      message.info('暂无打卡数据');
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    const start = fmtDate(weekRange[0]);
    const end = fmtDate(weekRange[1]);
    // 格式化日期为 M.D
    const fmt = (s) => {
      const [y, m, d] = s.split('-');
      return `${parseInt(m)}.${parseInt(d)}`;
    };
    let text = `🏆 Deer Edu 本周学习光荣榜（${fmt(start)}-${fmt(end)}）\n`;
    weekRows.forEach((row, i) => {
      if (row.checkinDays === 0 && row.studyHours === 0) return;
      const medal = medals[i] || '';
      text += `${medal} ${row.nickName}：打卡${row.checkinDays}天 · 学习${row.studyHours}小时`;
      if (row.streak > 0) text += ` · 连续${row.streak}天`;
      text += '\n';
    });
    text += '坚持就是胜利，下周继续加油！';

    navigator.clipboard
      .writeText(text)
      .then(() => message.success('表彰文案已复制，可直接粘贴到群聊'))
      .catch(() => {
        // 降级：用 textarea
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        message.success('表彰文案已复制');
      });
  };

  const weekColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_, __, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        return <span style={{ fontSize: 16 }}>{medals[i] || i + 1}</span>;
      },
    },
    {
      title: '学生',
      dataIndex: 'nickName',
      key: 'nickName',
      width: 100,
    },
    {
      title: '打卡天数',
      dataIndex: 'checkinDays',
      key: 'checkinDays',
      width: 90,
      sorter: (a, b) => a.checkinDays - b.checkinDays,
      render: (v) => (
        <span style={{ color: v > 0 ? '#12B7A8' : '#ccc', fontWeight: v > 0 ? 600 : 400 }}>
          {v}
        </span>
      ),
    },
    {
      title: '完成项数',
      dataIndex: 'completedItems',
      key: 'completedItems',
      width: 90,
      sorter: (a, b) => a.completedItems - b.completedItems,
    },
    {
      title: '学习时长',
      key: 'studyHours',
      width: 100,
      sorter: (a, b) => a.studyHours - b.studyHours,
      render: (_, r) => (
        <span style={{ color: r.studyHours > 0 ? '#12B7A8' : '#ccc' }}>
          {r.studyHours}h
        </span>
      ),
    },
    {
      title: '连续天数',
      dataIndex: 'streak',
      key: 'streak',
      width: 90,
      sorter: (a, b) => a.streak - b.streak,
      render: (v) =>
        v > 0 ? (
          <span style={{ color: '#f5a623', fontWeight: 600 }}>
            <FireOutlined /> {v}
          </span>
        ) : (
          <span style={{ color: '#ccc' }}>0</span>
        ),
    },
  ];

  return (
    <div className="checkin-page">
      {/* 发布区 */}
      <Card
        title="每日打卡任务发布"
        extra={
          <Space>
            <DatePicker
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              allowClear={false}
            />
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Spin spinning={loading}>
          {dayTasks.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                <span style={{ color: '#8E8E93', fontSize: 13 }}>当日任务组：</span>
                {dayTasks.map((t) => (
                  <Button
                    key={t.classKey || 'all'}
                    size="small"
                    type={t.classKey === activeKey ? 'primary' : 'default'}
                    onClick={() => switchGroup(t.classKey)}
                  >
                    {groupLabel(t.classIds)}（{(t.items || []).length}项）
                  </Button>
                ))}
                <Button
                  size="small"
                  type={activeKey === NEW_GROUP_KEY ? 'primary' : 'dashed'}
                  onClick={() => switchGroup(NEW_GROUP_KEY)}
                >
                  + 新建一组
                </Button>
              </Space>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <Space>
              <Button icon={<CopyOutlined />} onClick={handleCopyYesterday}>
                复制昨日
              </Button>
              <Select
                placeholder="从历史记录复制"
                style={{ width: 260 }}
                loading={historyLoading}
                onChange={handleCopyFromHistory}
                allowClear
                options={historyList.map((h) => ({
                  label: `${h.date}（${groupLabel(h.classIds)} · ${h.items.length}项 · ${h.totalMinutes}分钟）`,
                  value: h.date,
                }))}
              />
            </Space>
          </div>

          <Form form={form} initialValues={{ items: [{}] }}>
            <Form.Item
              name="classIds"
              label="发布对象"
              extra="不选班级 = 全体学生可见；同一发布对象每天仅保留一组任务，重复保存将覆盖该组"
            >
              <Select
                mode="multiple"
                allowClear
                placeholder="默认全体学生"
                options={classes.map((c) => ({
                  value: c._id,
                  label: `${c.name}（${c.studentCount || 0}人）`,
                }))}
              />
            </Form.Item>
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        marginBottom: 12,
                      }}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, 'subject']}
                        rules={[
                          { required: true, message: '请填写科目' },
                          { max: 4, message: '科目最多 4 个字' },
                        ]}
                        style={{ width: 110, flexShrink: 0 }}
                      >
                        <AutoComplete
                          placeholder="科目"
                          options={SUBJECT_OPTIONS}
                          maxLength={4}
                          filterOption={(input, option) =>
                            (option?.value || '').includes(input)
                          }
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'content']}
                        rules={[{ required: true, message: '请输入任务内容' }]}
                        style={{ flex: 1 }}
                      >
                        <Input placeholder="任务内容，如：精听剑18 Test1 Part3 并跟读" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'suggestMinutes']}
                        rules={[{ required: true, message: '请填写建议分钟' }]}
                        style={{ width: 130, flexShrink: 0 }}
                      >
                        <InputNumber
                          placeholder="建议分钟"
                          min={1}
                          max={300}
                          addonAfter="分钟"
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      {fields.length > 1 && (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                          style={{ flexShrink: 0, marginTop: 5 }}
                        />
                      )}
                    </div>
                  ))}
                  {fields.length < 4 && (
                    <Button
                      type="dashed"
                      onClick={() => add({ subject: '听力', suggestMinutes: 30 })}
                      icon={<PlusOutlined />}
                      style={{ width: 200 }}
                    >
                      添加任务项
                    </Button>
                  )}
                </>
              )}
            </Form.List>
          </Form>

          <div
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: '#f6ffed',
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#52c41a' }}>
              建议总时长：<strong>{totalMin}</strong> 分钟
              {totalMin > 0 && <span>（约 {Math.round((totalMin / 60) * 10) / 10} 小时）</span>}
            </span>
            <Button
              type="primary"
              loading={saving}
              onClick={handleSave}
              style={{ background: '#12B7A8' }}
            >
              保存并发布
            </Button>
          </div>
        </Spin>
      </Card>

      {/* 周表彰区 */}
      <Card
        title="周打卡统计"
        extra={
          <Space>
            <RangePicker
              value={weekRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setWeekRange(dates);
                }
              }}
              allowClear={false}
            />
            <Button icon={<ReloadOutlined />} onClick={() => loadWeekStats(weekRange)}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<TrophyOutlined />}
              onClick={generatePraiseText}
              style={{ background: '#12B7A8' }}
            >
              生成表彰文案
            </Button>
          </Space>
        }
      >
        <Table
          columns={weekColumns}
          dataSource={weekRows}
          rowKey="_id"
          loading={weekLoading}
          pagination={false}
          size="middle"
          locale={{
            emptyText: <Empty description="暂无打卡数据" />,
          }}
        />
      </Card>
    </div>
  );
}
