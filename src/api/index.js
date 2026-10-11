import { callFunction } from '../cloudbase';

/**
 * 云函数调用统一出口
 * 各方法返回云函数 result（{ success, data, error, ... }）
 */

// ---------- 鉴权 ----------

/** 微信扫码登录：用 code 换 unionid，校验管理员，签发 token */
export const adminLogin = (data) => callFunction('adminLogin', data);

/** 校验 token 有效性 */
export const adminVerify = () => callFunction('adminVerify', {});

// ---------- 排课 ----------

/** 获取课程列表（日期范围 + 分页） */
export const getCourses = (data) => callFunction('getCourses', data);

/** 新增/更新课程（管理员写操作） */
export const saveCourse = (data) => callFunction('saveCourse', data);

/** 删除课程 */
export const deleteCourse = (data) => callFunction('deleteCourse', data);

// ---------- 学生 ----------

/** 获取学生列表 */
export const getAllUsers = (data) => callFunction('getAllUsers', data);

/** 学生数据分析聚合 */
export const adminStats = (data) => callFunction('adminStats', data);

// ---------- 测评 ----------

/** 测评报告：单生详情 + 全体分布 */
export const adminAssessment = (data) => callFunction('adminAssessment', data);

/** AI 智能测评报告：能力图谱 + 大模型分析 */
export const aiGenerateReport = (data) => callFunction('aiGenerateReport', data);

// ---------- 测评授权 ----------

/** 测评授权管理：列表 / 授权 / 吊销 / 恢复 */
export const assessmentGrant = (data) => callFunction('assessmentGrant', data);

// ---------- 数据看板 ----------

/** 统计看板：概览 / 14天趋势 / 操作记录 / 访问记录 */
export const adminDashboard = (data) => callFunction('adminDashboard', data);

// ---------- 管理员管理 ----------

/** 管理员账号管理：列表 / 新增 / 重置密码 / 自行改密 */
export const adminManage = (data) => callFunction('adminManage', data);

// ---------- 班级管理 ----------

/** 班级管理：列表 / 新建 / 重命名 / 删除 / 设置成员 */
export const manageClasses = (data) => callFunction('manageClasses', data);

// ---------- 打卡 ----------

/** 发布/保存每日打卡任务（管理员） */
export const saveDailyTask = (data) => callFunction('saveDailyTask', data);

/** 获取每日打卡任务（按日期 / 历史列表） */
export const getDailyTasks = (data) => callFunction('getDailyTasks', data);

export default {
  adminLogin,
  adminVerify,
  getCourses,
  saveCourse,
  deleteCourse,
  getAllUsers,
  adminStats,
  adminAssessment,
  aiGenerateReport,
  assessmentGrant,
  adminDashboard,
  adminManage,
  manageClasses,
  saveDailyTask,
  getDailyTasks,
};
