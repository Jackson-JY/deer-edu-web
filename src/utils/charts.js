/**
 * ECharts 共享样式与趋势柱状图构建（Dashboard / Students / Assessment 共用）
 */

// 图表通用样式（品牌薄荷 + Apple 系统色）
export const AXIS_LABEL = { color: '#8E8E93', fontSize: 11 };
export const SPLIT_LINE = { lineStyle: { color: '#EFEFF2' } };
export const TOOLTIP_CARD = {
  backgroundColor: '#FFFFFF',
  borderColor: '#E5E5EA',
  borderWidth: 1,
  textStyle: { color: '#1D1D1F', fontSize: 12 },
  extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-radius: 10px;',
};
/** 轴向阴影指示 tooltip（柱状图常用） */
export const AXIS_TOOLTIP = { trigger: 'axis', axisPointer: { type: 'shadow' }, ...TOOLTIP_CARD };

export const GRANULARITY_OPTIONS = [
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
];
export const GRANULARITY_TITLE = { day: '近 14 天', week: '近 12 周', month: '近 12 月' };

/** 柱状图 x 轴标签：month(YYYY-MM) 用 M月，day/week(YYYY-MM-DD) 用 M/D */
export function axisLabelOf(label) {
  if (/^\d{4}-\d{2}$/.test(label)) return `${parseInt(label.split('-')[1], 10)}月`;
  const p = String(label).split('-');
  return p.length >= 3 ? `${parseInt(p[1], 10)}/${parseInt(p[2], 10)}` : label;
}

/**
 * 趋势柱状图通用配置
 * @param {object} opts
 * @param {string[]} opts.dates        x 轴类目
 * @param {Array}    opts.series       [{ name, data, color }]
 * @param {object}  [opts.legend]      覆盖默认 legend（如需 data 数组）
 * @param {object}  [opts.grid]        覆盖默认 grid
 */
export function barTrendOption({ dates, series, legend, grid }) {
  return {
    tooltip: AXIS_TOOLTIP,
    legend: legend || { bottom: 0, icon: 'circle', textStyle: { color: '#6E6E73', fontSize: 12 } },
    grid: grid || { left: 40, right: 20, top: 20, bottom: 56 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { ...AXIS_LABEL, interval: 'auto', formatter: axisLabelOf },
      axisLine: { lineStyle: { color: '#E5E5EA' } },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', minInterval: 1, axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    series: series.map((s) => ({
      name: s.name,
      type: 'bar',
      barMaxWidth: 14,
      data: s.data,
      itemStyle: { color: s.color, borderRadius: [3, 3, 0, 0] },
    })),
  };
}
