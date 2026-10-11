import dayjs from 'dayjs';

/** 解析截止时间（'YYYY-MM-DD' 字符串、ISO 字符串或空），返回时间戳或 null */
export function parseExpireTs(v) {
  if (v === null || v === undefined || v === '') return null;
  const ts = new Date(v).getTime();
  return Number.isNaN(ts) ? null : ts;
}

/** 今天 0 点的时间戳 */
export function startOfTodayTs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 获取给定日期所在周的周一（dayjs 对象） */
export function getMonday(d) {
  const date = dayjs(d);
  const day = date.day(); // 0=Sunday, 1=Monday...
  const diff = day === 0 ? -6 : 1 - day;
  return date.add(diff, 'day');
}

/** 格式化日期 YYYY-MM-DD（入参为 dayjs 对象） */
export function fmtDate(d) {
  return d.format('YYYY-MM-DD');
}
