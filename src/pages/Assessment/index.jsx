import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Row, Col, Select, Statistic, Tag, Empty, Descriptions, Collapse, List, message, Spin, Button, Table, Typography, Divider, Progress } from 'antd';
import ReactECharts from 'echarts-for-react';
import { adminAssessment, aiGenerateReport } from '../../api';
import { getTempFileURL } from '../../cloudbase';
import { ASSESSMENT_ITEMS, SCORE_LABELS } from '../../data/assessmentItems';

const { Paragraph, Text } = Typography;

const SKILLS = ['listening', 'reading', 'writing', 'speaking'];
const SKILL_NAMES = { listening: '听力', reading: '阅读', writing: '写作', speaking: '口语' };
const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CEFR_COLOR = { A1: '#c9cdd4', A2: '#a7fbf5', B1: '#7ed6c4', B2: '#12b7a8', C1: '#0d9488', C2: '#065f46' };

const radarOption = (levels) => ({
  radar: {
    indicator: SKILLS.map((s) => ({ name: SKILL_NAMES[s], max: 5 })),
    radius: '65%',
    splitArea: { areaStyle: { color: ['#fafafa', '#f0f2f5'] } },
  },
  series: [
    {
      type: 'radar',
      data: [
        {
          value: SKILLS.map((s) => levels[s] ?? 0),
          name: '能力等级',
          areaStyle: { color: 'rgba(18,183,168,0.25)' },
          lineStyle: { color: '#12b7a8' },
          itemStyle: { color: '#12b7a8' },
        },
      ],
    },
  ],
});

const vocabBarOption = (buckets) => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 50, right: 20, top: 20, bottom: 40 },
  xAxis: { type: 'category', data: buckets.map((b) => b.label), axisLabel: { rotate: 40 } },
  yAxis: { type: 'value', minInterval: 1 },
  series: [{ type: 'bar', data: buckets.map((b) => b.count), itemStyle: { color: '#12b7a8' }, barMaxWidth: 32 }],
});

const cefrPieOption = (cefr) => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [
    {
      type: 'pie',
      radius: ['40%', '70%'],
      data: CEFR_ORDER.filter((k) => cefr[k]).map((k) => ({
        name: k,
        value: cefr[k],
        itemStyle: { color: CEFR_COLOR[k] },
      })),
      label: { formatter: '{b}: {c}' },
    },
  ],
});

/** 自评分数 → 颜色（分数越高问题越严重，颜色越红） */
function getScoreColor(score) {
  const s = Number(score) || 0;
  if (s <= 1) return '#52c41a';
  if (s <= 2) return '#faad14';
  if (s <= 3) return '#fa8c16';
  if (s <= 4) return '#ff7a45';
  return '#ff4d4f';
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
      } else {
        message.error(res.error || '加载失败');
      }
    } catch (e) {
      message.error(e.message || '加载失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleGenerateReport = useCallback(async () => {
    if (!selectedId) return;
    setAiLoading(true);
    setAiReport(null);
    try {
      const res = await aiGenerateReport({ studentId: selectedId });
      if (res.success) {
        setAiReport(res);
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
                    <span style={{ fontSize: 13, color: '#595959', lineHeight: 1.6, flex: 1 }}>{item.text}</span>
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
              icon={<span>✨</span>}
              loading={aiLoading}
              disabled={!selectedId || detailLoading}
              onClick={handleGenerateReport}
            >
              AI 智能分析
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
                  {detail.vocab?.cefrLevel && <Tag color="cyan" style={{ marginTop: 8 }}>{detail.vocab.cefrLevel}</Tag>}
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
                  {detail.completeTime && <div style={{ color: '#8a8f99', fontSize: 12, marginTop: 4 }}>{new Date(detail.completeTime).toLocaleString('zh-CN')}</div>}
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
                        const scoreColor = (v) => {
                          const n = Number(v) || 0;
                          if (n >= 80) return '#52c41a';
                          if (n >= 60) return '#faad14';
                          return '#ff4d4f';
                        };
                        return (
                          <div style={{ marginBottom: 24, padding: 16, background: '#f0f9ff', borderRadius: 8 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8, color: '#1890ff' }}>🎯 跟读评测</div>
                            <p style={{ color: '#595959', marginBottom: 8 }}>{shadowing.question}</p>
                            {audioUrl && (
                              <div style={{ marginBottom: 8 }}>
                                <audio controls src={audioUrl} style={{ width: '100%', maxWidth: 400 }} />
                              </div>
                            )}
                            {shadowing.duration != null && <Tag style={{ marginBottom: 8 }}>时长 {shadowing.duration}s</Tag>}
                            {soe ? (
                              <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>SOE 发音评分：</div>
                                <Row gutter={16}>
                                  <Col span={8}>
                                    <Card size="small">
                                      <Statistic
                                        title="准确度"
                                        value={Math.round(soe.pronAccuracy)}
                                        suffix="/100"
                                        valueStyle={{ color: scoreColor(soe.pronAccuracy) }}
                                      />
                                    </Card>
                                  </Col>
                                  <Col span={8}>
                                    <Card size="small">
                                      <Statistic
                                        title="流利度"
                                        value={Math.round(soe.pronFluency)}
                                        suffix="/100"
                                        valueStyle={{ color: scoreColor(soe.pronFluency) }}
                                      />
                                    </Card>
                                  </Col>
                                  <Col span={8}>
                                    <Card size="small">
                                      <Statistic
                                        title="完整度"
                                        value={Math.round(soe.pronCompletion)}
                                        suffix="/100"
                                        valueStyle={{ color: scoreColor(soe.pronCompletion) }}
                                      />
                                    </Card>
                                  </Col>
                                </Row>
                              </div>
                            ) : (
                              <p style={{ color: '#faad14', fontSize: 12, marginTop: 8 }}>
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
                                    <p style={{ color: '#666', marginBottom: 8 }}>{item.question}</p>
                                    {audioUrl ? (
                                      <div style={{ marginBottom: 8 }}>
                                        <audio controls src={audioUrl} style={{ width: '100%', maxWidth: 400 }} />
                                      </div>
                                    ) : item.audioFileID ? (
                                      <p style={{ color: '#c0c4cc', fontSize: 12 }}>音频链接解析中或已失效</p>
                                    ) : null}
                                    {item.duration != null && <Tag style={{ marginBottom: 8 }}>时长 {item.duration}s</Tag>}
                                    {item.transcribedText ? (
                                      <div style={{ marginTop: 4 }}>
                                        <b>转写文本：</b>
                                        <span style={{ color: '#595959' }}>{item.transcribedText}</span>
                                      </div>
                                    ) : asrFailed ? (
                                      <p style={{ color: '#ff4d4f', fontSize: 12 }}>
                                        转写失败{item.asrError ? `：${item.asrError}` : ''}
                                      </p>
                                    ) : (
                                      <span style={{ color: '#c0c4cc', fontSize: 12 }}>暂无转写文本（ASR 处理中或未配置）</span>
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
              <span style={{ fontSize: 16, fontWeight: 600 }}>✨ AI 智能分析报告</span>
              {aiReport?.model && <Tag style={{ marginLeft: 8 }}>模型：{aiReport.model}</Tag>}
            </Divider>

            {aiLoading ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin tip="正在生成 AI 分析报告，请稍候..." />
              </div>
            ) : aiReport ? (
              <div>
                {/* Part 1：能力图谱表格 */}
                <div style={{ marginBottom: 24 }}>
                  <div className="chart-title" style={{ marginBottom: 12 }}>第一部分：能力图谱</div>
                  {aiReport.part1?.vocab && (
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic title="词汇量" value={aiReport.part1.vocab.estimate} suffix="词" valueStyle={{ color: '#12b7a8' }} />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic title="词汇 CEFR" value={aiReport.part1.vocab.cefrLevel || '-'} />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic title="综合 CEFR" value={aiReport.part1.cefrLevel || '-'} valueStyle={{ color: '#1677ff' }} />
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
                        render: (v) => <Text strong style={{ color: v >= 3 ? '#ff4d4f' : v >= 2 ? '#faad14' : '#52c41a' }}>{v.toFixed(1)}</Text>,
                      },
                      {
                        title: '平均问题指数 (0-100)',
                        dataIndex: 'problemIndex',
                        width: 160,
                        render: (v) => (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${v}%`, height: '100%', background: v >= 60 ? '#ff4d4f' : v >= 40 ? '#faad14' : '#52c41a', borderRadius: 4 }} />
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
                                <li key={i} style={{ fontSize: 13, lineHeight: 1.8, color: '#595959' }}>{p}</li>
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
                    <Paragraph style={{ whiteSpace: 'pre-wrap', color: '#595959' }}>{aiReport.part2.raw}</Paragraph>
                  ) : (
                    <div>
                      {aiReport.part2?.summary && (
                        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f6ffed', borderRadius: 8, borderLeft: '3px solid #52c41a' }}>
                          <Text strong style={{ color: '#389e0d' }}>▎整体概述</Text>
                          <Paragraph style={{ margin: '8px 0 0', color: '#595959', lineHeight: 1.8 }}>{aiReport.part2.summary}</Paragraph>
                        </div>
                      )}
                      {aiReport.part2?.characteristics && (
                        <div style={{ marginBottom: 16 }}>
                          <Text strong>▎核心特点</Text>
                          <Paragraph style={{ margin: '8px 0 0', color: '#595959', lineHeight: 1.8 }}>{aiReport.part2.characteristics}</Paragraph>
                        </div>
                      )}
                      {aiReport.part2?.improvementPath && (
                        <div style={{ marginBottom: 16 }}>
                          <Text strong>▎核心提分路径</Text>
                          <Paragraph style={{ margin: '8px 0 0', color: '#1677ff', lineHeight: 1.8, fontWeight: 500 }}>{aiReport.part2.improvementPath}</Paragraph>
                        </div>
                      )}
                      {aiReport.part2?.learningPath && aiReport.part2.learningPath.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <Text strong>▎整体学习路径建议</Text>
                          <div style={{ marginTop: 8 }}>
                            {aiReport.part2.learningPath.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: '#12b7a8', color: '#fff', fontSize: 12, flexShrink: 0 }}>{idx + 1}</span>
                                <div>
                                  <Text strong>{item.title}</Text>
                                  <div style={{ color: '#8c8c8c', fontSize: 13, lineHeight: 1.6 }}>{item.desc}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {aiReport.part2?.trainingLogic && (
                        <div style={{ padding: '12px 16px', background: '#f0f5ff', borderRadius: 8 }}>
                          <Text strong style={{ color: '#1677ff' }}>▎整体训练逻辑</Text>
                          <Paragraph style={{ margin: '8px 0 0', color: '#595959', lineHeight: 1.8 }}>{aiReport.part2.trainingLogic}</Paragraph>
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
                    点击上方 <Text strong style={{ color: '#12b7a8' }}>「AI 智能分析」</Text> 按钮，为该学生生成智能测评报告
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
