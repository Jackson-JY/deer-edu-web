import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Row, Col, Select, Statistic, Tag, Empty, Descriptions, Collapse, List, message, Spin, Button, Table, Typography, Divider, Progress } from 'antd';
import { ThunderboltOutlined, AimOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { adminAssessment, aiGenerateReport } from '../../api';
import { getTempFileURL } from '../../cloudbase';
import { ASSESSMENT_ITEMS, SCORE_LABELS } from '../../data/assessmentItems';

const { Paragraph, Text } = Typography;

const SKILLS = ['listening', 'reading', 'writing', 'speaking'];
const SKILL_NAMES = { listening: '听力', reading: '阅读', writing: '写作', speaking: '口语' };
const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
// CEFR 色阶：中性灰起步，收敛到品牌薄荷绿
const CEFR_COLOR = { A1: '#C7C7CC', A2: '#A9E4DD', B1: '#6FCFC3', B2: '#12B7A8', C1: '#0E8C81', C2: '#0A6B62' };

// 图表通用样式
const AXIS_LABEL = { color: '#8E8E93', fontSize: 11 };
const SPLIT_LINE = { lineStyle: { color: '#EFEFF2' } };
const TOOLTIP_CARD = {
  backgroundColor: '#FFFFFF',
  borderColor: '#E5E5EA',
  borderWidth: 1,
  textStyle: { color: '#1D1D1F', fontSize: 12 },
  extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-radius: 10px;',
};

const radarOption = (levels) => ({
  tooltip: TOOLTIP_CARD,
  radar: {
    indicator: SKILLS.map((s) => ({ name: SKILL_NAMES[s], max: 5 })),
    radius: '64%',
    center: ['50%', '48%'],
    axisName: { color: '#6E6E73', fontSize: 12 },
    splitLine: { lineStyle: { color: '#E5E5EA' } },
    splitArea: { areaStyle: { color: ['#FFFFFF', '#FAFAFB'] } },
    axisLine: { lineStyle: { color: '#E5E5EA' } },
  },
  series: [
    {
      type: 'radar',
      symbolSize: 5,
      data: [
        {
          value: SKILLS.map((s) => levels[s] ?? 0),
          name: '能力等级',
          areaStyle: { color: 'rgba(18,183,168,0.22)' },
          lineStyle: { color: '#12B7A8', width: 2 },
          itemStyle: { color: '#12B7A8' },
        },
      ],
    },
  ],
});

const vocabBarOption = (buckets) => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...TOOLTIP_CARD },
  grid: { left: 46, right: 16, top: 20, bottom: 44 },
  xAxis: {
    type: 'category',
    data: buckets.map((b) => b.label),
    axisLabel: { ...AXIS_LABEL, rotate: 32 },
    axisLine: { lineStyle: { color: '#E5E5EA' } },
    axisTick: { show: false },
  },
  yAxis: { type: 'value', minInterval: 1, axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
  series: [
    {
      type: 'bar',
      data: buckets.map((b) => b.count),
      itemStyle: { color: '#12B7A8', borderRadius: [6, 6, 0, 0] },
      barMaxWidth: 30,
    },
  ],
});

const cefrPieOption = (cefr) => ({
  tooltip: { trigger: 'item', ...TOOLTIP_CARD },
  legend: { bottom: 0, icon: 'circle', textStyle: { color: '#6E6E73' } },
  series: [
    {
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '44%'],
      itemStyle: { borderColor: '#FFFFFF', borderWidth: 2 },
      data: CEFR_ORDER.filter((k) => cefr[k]).map((k) => ({
        name: k,
        value: cefr[k],
        itemStyle: { color: CEFR_COLOR[k] },
      })),
      label: { color: '#6E6E73', formatter: '{b} {c}' },
    },
  ],
});

/** 自评分数 → 颜色（分数越高问题越严重，颜色越红）；Apple 系统色阶 */
function getScoreColor(score) {
  const s = Number(score) || 0;
  if (s <= 1) return '#34C759';
  if (s <= 2) return '#FFCC00';
  if (s <= 3) return '#FF9500';
  if (s <= 4) return '#FF6B4A';
  return '#FF3B30';
}

/** SOE 百分制评分 → 颜色 */
function getSoeScoreColor(v) {
  const n = Number(v) || 0;
  if (n >= 80) return '#34C759';
  if (n >= 60) return '#FF9500';
  return '#FF3B30';
}

/** 自评分数档位文案 */
function getScoreLabel(score) {
  const s = Math.round(Number(score) || 0);
  const item = SCORE_LABELS.find((x) => x.value === s);
  return item ? item.label : '';
}

export default function Assessment() {
  const [students, setStudents] = useState([]);
  const [distribution, setDistribution] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  // AI 报告
  const [aiReport, setAiReport] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  // 口语录音临时播放链接（cloud:// → https://）
  const [audioUrls, setAudioUrls] = useState({});

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await adminAssessment({ action: 'list' });
      if (res.success) {
        setStudents(res.students || []);
        setDistribution(res.distribution || null);
      } else {
        message.error(res.error || '加载失败');
      }
    } catch (e) {
      message.error(e.message || '加载失败');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (studentId) => {
    setDetailLoading(true);
    setDetail(null);
    setAiReport(null);
    setAudioUrls({});
    try {
      const res = await adminAssessment({ action: 'detail', studentId });
      if (res.success) {
        const d = res.detail || null;
        setDetail(d);
        // 批量转换口语录音 cloud:// fileID 为可播放的 HTTPS 链接
        const speaking = d?.speaking || [];
        const fileIDs = speaking.map((a) => a.audioFileID).filter(Boolean);
        if (fileIDs.length) {
          const urls = await getTempFileURL(fileIDs);
          const map = {};
          fileIDs.forEach((fid, i) => {
            map[fid] = urls[i] || '';
          });
          setAudioUrls(map);
        }
        // 回显已保存的 AI 报告（只查缓存，不触发模型）
        try {
          const cacheRes = await aiGenerateReport({ studentId, cacheOnly: true });
          setAiReport(cacheRes.success && cacheRes.cached ? cacheRes : null);
        } catch (cacheErr) {
          setAiReport(null);
        }
      } else {
        message.error(res.error || '加载失败');
      }
    } catch (e) {
      message.error(e.message || '加载失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleGenerateReport = useCallback(async (force = false) => {
    if (!selectedId) return;
    setAiLoading(true);
    setAiReport(null);
    try {
      const res = await aiGenerateReport({ studentId: selectedId, force });
      if (res.success) {
        setAiReport(res);
        if (res.cached) {
          message.success('已加载上次生成的报告');
        } else {
          message.success(force ? '已使用最新测评数据重新生成' : 'AI 分析报告已生成并保存');
        }
      } else {
        message.error(res.error || '生成报告失败');
      }
    } catch (e) {
      message.error(e.message || '生成报告失败');
    } finally {
      setAiLoading(false);
    }
  }, [selectedId]);

  const levels = useMemo(() => {
    const sa = detail?.selfAssess || {};
    const lv = {};
    SKILLS.forEach((s) => {
      lv[s] = sa[s]?.level ?? 0;
    });
    return lv;
  }, [detail]);

  const hasSelfAssess = useMemo(() => Object.keys(detail?.selfAssess || {}).length > 0, [detail]);

  // 四科自评明细（12 条题目 + 评分）
  const selfAssessDetailItems = useMemo(() => {
    const sa = detail?.selfAssess || {};
    return SKILLS.map((skill) => {
      const ratings = sa[skill]?.ratings || [];
      const items = ASSESSMENT_ITEMS[skill] || [];
      const level = sa[skill]?.level;
      return {
        key: skill,
        label: (
          <span>
            {SKILL_NAMES[skill]}自评明细
            <Tag color={level != null ? getScoreColor(level) : 'default'} style={{ marginLeft: 8 }}>
              {level != null ? level.toFixed(1) : '-'} / 5.0
            </Tag>
          </span>
        ),
        children: ratings.length ? (
          <List
            dataSource={items.map((text, i) => ({ text, score: ratings[i] ?? 0 }))}
            renderItem={(item) => (
              <List.Item>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#6E6E73', lineHeight: 1.6, flex: 1 }}>{item.text}</span>
                    <Tag color={getScoreColor(item.score)} style={{ marginLeft: 8, flexShrink: 0 }}>
                      {item.score} · {getScoreLabel(item.score)}
                    </Tag>
                  </div>
                  <Progress
                    percent={Math.round((item.score / 5) * 100)}
                    showInfo={false}
                    strokeColor={getScoreColor(item.score)}
                    size="small"
                  />
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="该科目暂无自评数据" />
        ),
      };
    });
  }, [detail]);

  // 整体学习路径建议：短期/长期课程组合（coursePlan 为新结构，learningPath 为旧缓存兜底）
  const renderCoursePlan = () => {
    const part2 = aiReport?.part2 || {};
    const plan = part2.coursePlan;
    if (plan && ((plan.shortTerm && plan.shortTerm.length) || (plan.longTerm && plan.longTerm.length))) {
      const groups = [
        { key: 'st', label: '短期建议', hint: '约 1 个月 · 集中突破最紧迫短板', color: '#12B7A8', items: plan.shortTerm || [] },
        { key: 'lt', label: '长期规划', hint: '约 2-3 个月 · 系统提升与出分保障', color: '#0A6B62', items: plan.longTerm || [] },
      ];
      return (
        <div style={{ marginBottom: 16 }}>
          <Text strong>整体学习路径建议 · 课程组合</Text>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {groups.map((g) => g.items.length > 0 && (
              <div key={g.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ background: g.color, color: '#fff', fontSize: 12, fontWeight: 600, padding: '3px 12px', borderRadius: 999, lineHeight: 1.6 }}>
                    {g.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#8E8E93' }}>{g.hint}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {g.items.map((c, i) => (
                    <div key={i} style={{ background: '#F5FBFA', border: '1px solid #E3F2F0', borderRadius: 12, padding: '10px 14px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F' }}>{c.course}</div>
                      <div style={{ fontSize: 13, color: '#6E6E73', lineHeight: 1.7, marginTop: 4 }}>{c.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (part2.learningPath && part2.learningPath.length > 0) {
      return (
        <div style={{ marginBottom: 16 }}>
          <Text strong>整体学习路径建议</Text>
          <div style={{ marginTop: 10 }}>
            {part2.learningPath.map((item, idx) => (
              <div key={idx} className="path-step">
                <span className="path-step-index">{idx + 1}</span>
                <div>
                  <div className="path-step-title">{item.title}</div>
                  <div className="path-step-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">测评报告</h2>
        <p className="page-desc">全体能力分布与单生测评报告</p>
      </div>

      {/* 全体分布 */}
      <Card title="全体分布" loading={listLoading} style={{ marginBottom: 16 }}>
        {distribution ? (
          <Row gutter={16}>
            <Col span={8}>
              <div className="chart-title">词汇量分布</div>
              <ReactECharts option={vocabBarOption(distribution.vocabBuckets || [])} style={{ height: 260 }} />
            </Col>
            <Col span={8}>
              <div className="chart-title">CEFR 等级分布</div>
              {distribution.cefr && Object.values(distribution.cefr).some(Boolean) ? (
                <ReactECharts option={cefrPieOption(distribution.cefr)} style={{ height: 260 }} />
              ) : (
                <Empty description="暂无数据" style={{ marginTop: 80 }} />
              )}
            </Col>
            <Col span={8}>
              <div className="chart-title">四维能力均值</div>
              {distribution.skillAverages ? (
                <ReactECharts option={radarOption(distribution.skillAverages)} style={{ height: 260 }} />
              ) : (
                <Empty description="暂无数据" style={{ marginTop: 80 }} />
              )}
            </Col>
          </Row>
        ) : (
          <Empty description="暂无测评数据" />
        )}
      </Card>

      {/* 单生报告 */}
      <Card
        title="单生报告"
        extra={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择学生"
              style={{ width: 200 }}
              value={selectedId}
              onChange={(v) => {
                setSelectedId(v);
                if (v) loadDetail(v);
              }}
              options={students.map((s) => ({ value: s._id, label: s.nickName || '未命名用户' }))}
            />
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={aiLoading}
              disabled={!selectedId || detailLoading}
              onClick={() => handleGenerateReport(!!aiReport)}
            >
              {aiReport ? '重新生成' : 'AI 智能分析'}
            </Button>
          </div>
        }
      >
        {!selectedId ? (
          <Empty description="请选择一个学生查看报告" />
        ) : detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : !detail ? (
          <Empty description="该学生暂无测评记录" />
        ) : (
          <div>
            {/* 词汇量 + CEFR */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card className="stat-card">
                  <Statistic
                    title="词汇量估算"
                    value={detail.vocab?.estimate ?? 0}
                    suffix="词"
                    valueStyle={{ color: '#12b7a8' }}
                  />
                  {detail.vocab?.cefrLevel && <Tag color="#12B7A8" style={{ marginTop: 8 }}>{detail.vocab.cefrLevel}</Tag>}
                </Card>
              </Col>
              <Col span={8}>
                <Card className="stat-card">
                  <Statistic title="答题数量" value={detail.vocab?.itemsAnswered ?? 0} suffix="题" />
                </Card>
              </Col>
              <Col span={8}>
                <Card className="stat-card">
                  <Statistic title="测评状态" value={detail.status === 'completed' ? '已完成' : '进行中'} />
                  {detail.completeTime && <div style={{ color: '#8E8E93', fontSize: 12, marginTop: 4 }}>{new Date(detail.completeTime).toLocaleString('zh-CN')}</div>}
                </Card>
              </Col>
            </Row>

            {/* 四维能力 */}
            {hasSelfAssess && (
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={10}>
                  <div className="chart-title">四维能力雷达</div>
                  <ReactECharts option={radarOption(levels)} style={{ height: 300 }} />
                </Col>
                <Col span={14}>
                  <div className="chart-title">各科自评等级</div>
                  <Descriptions bordered size="small" column={2}>
                    {SKILLS.map((s) => (
                      <Descriptions.Item key={s} label={SKILL_NAMES[s]}>
                        {levels[s] ? levels[s].toFixed(1) : '-'} / 5.0
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </Col>
              </Row>
            )}

            {/* 四科自评明细 */}
            {hasSelfAssess && (
              <div style={{ marginBottom: 16 }}>
                <div className="chart-title" style={{ marginBottom: 8 }}>能力模型自评明细（48 项）</div>
                <Collapse items={selfAssessDetailItems} />
              </div>
            )}

            {/* 产出题 */}
            <Collapse
              items={[
                {
                  key: 'writing',
                  label: '写作产出题',
                  children: detail.writing ? (
                    <div>
                      <p>
                        <b>句式改写：</b>
                        {detail.writing.task1?.prompt || '—'}
                      </p>
                      <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="句式一">{detail.writing.task1?.sentence1 || '—'}</Descriptions.Item>
                        <Descriptions.Item label="句式二">{detail.writing.task1?.sentence2 || '—'}</Descriptions.Item>
                        <Descriptions.Item label="句式三">{detail.writing.task1?.sentence3 || '—'}</Descriptions.Item>
                      </Descriptions>
                      <p style={{ marginTop: 12 }}>
                        <b>观点论证：</b>
                        {detail.writing.task2?.claim || '—'}
                      </p>
                      <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="论点 Claim">{detail.writing.task2?.claim || '—'}</Descriptions.Item>
                        <Descriptions.Item label="论据 Evidence">{detail.writing.task2?.evidence || '—'}</Descriptions.Item>
                        <Descriptions.Item label="论证 Reasoning">{detail.writing.task2?.reasoning || '—'}</Descriptions.Item>
                      </Descriptions>
                    </div>
                  ) : (
                    <Empty description="暂无写作产出题" />
                  ),
                },
                {
                  key: 'speaking',
                  label: '口语产出题',
                  children: detail.speaking && detail.speaking.length ? (
                    <div>
                      {/* 跟读评测（含 SOE 发音评分） */}
                      {(() => {
                        const shadowing = detail.speaking.find((a) => a.part === 'shadowing');
                        if (!shadowing) return null;
                        const soe = shadowing.soeResult;
                        const audioUrl = (shadowing.audioFileID && audioUrls[shadowing.audioFileID]) || '';
                        return (
                          <div className="soe-panel">
                            <div className="soe-panel-title"><AimOutlined />跟读评测</div>
                            <p style={{ color: '#6E6E73', marginBottom: 8 }}>{shadowing.question}</p>
                            {audioUrl && (
                              <div style={{ marginBottom: 8 }}>
                                <audio controls src={audioUrl} style={{ width: '100%', maxWidth: 400 }} />
                              </div>
                            )}
                            {shadowing.duration != null && <Tag style={{ marginBottom: 8 }}>时长 {shadowing.duration}s</Tag>}
                            {soe ? (
                              <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 13, color: '#6E6E73', marginBottom: 8 }}>SOE 发音评分：</div>
                                <Row gutter={16}>
                                  <Col span={8}>
                                    <Card size="small">
                                      <Statistic
                                        title="准确度"
                                        value={Math.round(soe.pronAccuracy)}
                                        suffix="/100"
                                        valueStyle={{ color: getSoeScoreColor(soe.pronAccuracy) }}
                                      />
                                    </Card>
                                  </Col>
                                  <Col span={8}>
                                    <Card size="small">
                                      <Statistic
                                        title="流利度"
                                        value={Math.round(soe.pronFluency)}
                                        suffix="/100"
                                        valueStyle={{ color: getSoeScoreColor(soe.pronFluency) }}
                                      />
                                    </Card>
                                  </Col>
                                  <Col span={8}>
                                    <Card size="small">
                                      <Statistic
                                        title="完整度"
                                        value={Math.round(soe.pronCompletion)}
                                        suffix="/100"
                                        valueStyle={{ color: getSoeScoreColor(soe.pronCompletion) }}
                                      />
                                    </Card>
                                  </Col>
                                </Row>
                              </div>
                            ) : (
                              <p style={{ color: '#FF9500', fontSize: 12, marginTop: 8 }}>
                                发音评分未生成（可能未配置腾讯云 SOE 服务）
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      {/* 产出题列表 */}
                      <List
                        dataSource={detail.speaking.filter((a) => a.part === 'production')}
                        renderItem={(item, idx) => {
                          const audioUrl = (item.audioFileID && audioUrls[item.audioFileID]) || '';
                          const asrDone = item.asrStatus === 'completed';
                          const asrFailed = item.asrStatus === 'failed';
                          return (
                            <List.Item>
                              <List.Item.Meta
                                title={`第 ${idx + 1} 题`}
                                description={
                                  <div>
                                    <p style={{ color: '#6E6E73', marginBottom: 8 }}>{item.question}</p>
                                    {audioUrl ? (
                                      <div style={{ marginBottom: 8 }}>
                                        <audio controls src={audioUrl} style={{ width: '100%', maxWidth: 400 }} />
                                      </div>
                                    ) : item.audioFileID ? (
                                      <p style={{ color: '#8E8E93', fontSize: 12 }}>音频链接解析中或已失效</p>
                                    ) : null}
                                    {item.duration != null && <Tag style={{ marginBottom: 8 }}>时长 {item.duration}s</Tag>}
                                    {item.transcribedText ? (
                                      <div style={{ marginTop: 4 }}>
                                        <b>转写文本：</b>
                                        <span style={{ color: '#6E6E73' }}>{item.transcribedText}</span>
                                      </div>
                                    ) : asrFailed ? (
                                      <p style={{ color: '#FF3B30', fontSize: 12 }}>
                                        转写失败{item.asrError ? `：${item.asrError}` : ''}
                                      </p>
                                    ) : (
                                      <span style={{ color: '#8E8E93', fontSize: 12 }}>暂无转写文本（ASR 处理中或未配置）</span>
                                    )}
                                  </div>
                                }
                              />
                            </List.Item>
                          );
                        }}
                      />
                    </div>
                  ) : (
                    <Empty description="暂无口语录音" />
                  ),
                },
              ]}
            />

            {/* ============ AI 智能分析报告 ============ */}
            <Divider orientation="left" style={{ marginTop: 32 }}>
              <span style={{ fontSize: 16, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <ThunderboltOutlined style={{ color: '#12B7A8' }} />
                AI 智能分析报告
              </span>
              {aiReport?.model && <Tag style={{ marginLeft: 8 }}>模型：{aiReport.model}</Tag>}
              {aiReport?.generatedAt && (
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  报告生成于 {new Date(aiReport.generatedAt).toLocaleString('zh-CN')}，已保存可直接查看
                </Text>
              )}
            </Divider>

            {aiLoading ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin tip="正在生成 AI 分析报告，请稍候..." />
              </div>
            ) : aiReport ? (
              <div>
                {/* 报告过期提示：缓存存在但源数据已更新 */}
                {aiReport.stale && (
                  <div
                    style={{
                      background: 'rgba(255, 159, 10, 0.08)',
                      border: '1px solid #FFD79A',
                      borderRadius: 10,
                      padding: '10px 14px',
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Text style={{ color: '#B26A00', fontSize: 13 }}>
                      测评数据已更新，以下报告可能过期，可点击右侧「重新生成」获取最新分析
                    </Text>
                    <Button
                      type="primary"
                      size="small"
                      icon={<ThunderboltOutlined />}
                      loading={aiLoading}
                      onClick={() => handleGenerateReport(true)}
                    >
                      重新生成
                    </Button>
                  </div>
                )}
                {/* Part 1：能力图谱表格 */}
                <div style={{ marginBottom: 24 }}>
                  <div className="chart-title" style={{ marginBottom: 12 }}>第一部分：能力图谱</div>
                  {aiReport.part1?.vocab && (
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic title="词汇量" value={aiReport.part1.vocab.estimate} suffix="词" valueStyle={{ color: '#0E8C81' }} />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic title="词汇 CEFR" value={aiReport.part1.vocab.cefrLevel || '-'} />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic title="综合 CEFR" value={aiReport.part1.cefrLevel || '-'} valueStyle={{ color: '#0E8C81' }} />
                        </Card>
                      </Col>
                    </Row>
                  )}
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="key"
                    dataSource={aiReport.part1?.skills || []}
                    columns={[
                      { title: '科目', dataIndex: 'name', width: 80 },
                      {
                        title: '分数 (0-5)',
                        dataIndex: 'score',
                        width: 120,
                        render: (v) => <Text strong style={{ color: v >= 3 ? '#FF3B30' : v >= 2 ? '#FF9500' : '#34C759' }}>{v.toFixed(1)}</Text>,
                      },
                      {
                        title: '平均问题指数 (0-100)',
                        dataIndex: 'problemIndex',
                        width: 160,
                        render: (v) => (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 8, background: '#F2F2F7', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ width: `${v}%`, height: '100%', background: v >= 60 ? '#FF3B30' : v >= 40 ? '#FF9500' : '#34C759', borderRadius: 999 }} />
                            </div>
                            <Text style={{ minWidth: 32 }}>{v}</Text>
                          </div>
                        ),
                      },
                      {
                        title: '当前主要问题',
                        dataIndex: 'mainProblems',
                        render: (arr) =>
                          arr && arr.length ? (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {arr.map((p, i) => (
                                <li key={i} style={{ fontSize: 13, lineHeight: 1.8, color: '#6E6E73' }}>{p}</li>
                              ))}
                            </ul>
                          ) : (
                            <Text type="secondary">暂无明显问题</Text>
                          ),
                      },
                    ]}
                  />
                </div>

                {/* Part 2：测评结果分析 */}
                <div>
                  <div className="chart-title" style={{ marginBottom: 12 }}>第二部分：测评结果分析</div>
                  {aiReport.part2?.raw ? (
                    <Paragraph style={{ whiteSpace: 'pre-wrap', color: '#6E6E73' }}>{aiReport.part2.raw}</Paragraph>
                  ) : (
                    <div>
                      {aiReport.part2?.summary && (
                        <div className="insight-block">
                          <div className="insight-block-title">整体概述</div>
                          <Paragraph className="insight-block-text">{aiReport.part2.summary}</Paragraph>
                        </div>
                      )}
                      {aiReport.part2?.characteristics && (
                        <div className="insight-block">
                          <div className="insight-block-title">核心特点</div>
                          <Paragraph className="insight-block-text">{aiReport.part2.characteristics}</Paragraph>
                        </div>
                      )}
                      {aiReport.part2?.improvementPath && (
                        <div className="insight-block insight-block--soft">
                          <div className="insight-block-title">核心提分路径</div>
                          <Paragraph className="insight-block-text" style={{ color: '#0E8C81', fontWeight: 500 }}>
                            {aiReport.part2.improvementPath}
                          </Paragraph>
                        </div>
                      )}
                      {renderCoursePlan()}
                      {aiReport.part2?.trainingLogic && (
                        <div className="insight-block insight-block--soft">
                          <div className="insight-block-title">整体训练逻辑</div>
                          <Paragraph className="insight-block-text">{aiReport.part2.trainingLogic}</Paragraph>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Empty
                description={
                  <span>
                    点击上方 <Text strong style={{ color: '#12b7a8' }}>「AI 智能分析」</Text> 按钮生成智能测评报告
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>报告生成后会自动保存，再次打开无需重新生成；测评数据更新后可点「重新生成」</Text>
                  </span>
                }
                style={{ padding: '40px 0' }}
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
