import cloudbase from '@cloudbase/js-sdk';

// 与小程序共用的云环境
const ENV_ID = 'cloud1-d7g66xvli7bb6bcc6';

// 管理员 token 存储 key
export const TOKEN_KEY = 'ielts_admin_token';
export const ADMIN_KEY = 'ielts_admin_info';

let _app = null;
let _authReady = null;
// 匿名登录是否失败（失败则降级为 HTTP 调用）
let _authFailed = false;

/**
 * 获取 CloudBase 应用实例（单例）
 * 首次调用时初始化并尝试匿名登录。
 * 匿名登录是 CloudBase Web SDK 调用 callFunction 的前置条件，但新版云环境默认关闭匿名登录，
 * 此时不抛出错误，而是标记 _authFailed，后续 callFunction 自动降级为 HTTP 调用。
 */
export function getApp() {
  if (!_app) {
    _app = cloudbase.init({ env: ENV_ID });
    _authReady = _app
      .auth()
      .signInAnonymously()
      .then(() => {
        // eslint-disable-next-line no-console
        console.log('[CloudBase] 匿名登录完成，env =', ENV_ID);
      })
      .catch((e) => {
        // 匿名登录未开启（云环境默认关闭），降级为 HTTP 调用
        _authFailed = true;
        // eslint-disable-next-line no-console
        console.warn('[CloudBase] 匿名登录未开启，将使用 HTTP 方式调用云函数：', e && e.message);
      });
  }
  return _app;
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token || '');
  } catch (e) {
    /* ignore */
  }
}

export function setAdminInfo(info) {
  try {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(info || {}));
  } catch (e) {
    /* ignore */
  }
}

export function getAdminInfo() {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearAuth() {
  setToken('');
  try {
    localStorage.removeItem(ADMIN_KEY);
  } catch (e) {
    /* ignore */
  }
}

/**
 * 处理云函数返回的鉴权错误（token 失效 → 清登录态 + 跳登录页）
 */
function handleAuthError(result) {
  if (result && result.authError) {
    clearAuth();
    if (typeof window !== 'undefined') {
      window.location.hash = '#/login';
    }
    throw new Error(result.error || '登录已过期');
  }
  return result;
}

/**
 * 通过 CloudBase SDK 调用云函数（需要匿名登录态）
 */
async function callFunctionBySDK(name, data) {
  const app = getApp();
  if (_authReady) {
    await _authReady;
  }
  if (_authFailed) {
    throw new Error('anonymous_login_disabled');
  }
  const res = await app.callFunction({
    name,
    data: { ...data, _token: getToken() },
  });
  // SDK 偶发返回 undefined（被域名白名单/网关静默拒绝），显式保护
  if (!res || typeof res !== 'object') {
    throw new Error(`CloudBase callFunction(${name}) 返回空响应，请检查 Web 域名白名单`);
  }
  return handleAuthError(res.result || {});
}

/**
 * 通过 HTTP 方式调用云函数（降级方案，无需匿名登录）
 * URL 格式：https://${envId}.service.tcloudbase.com/${functionName}
 * 需要在云开发控制台为对应云函数开启「HTTP 访问服务」。
 */
async function callFunctionByHttp(name, data) {
  const url = `https://${ENV_ID}.service.tcloudbase.com/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, _token: getToken() }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}：调用云函数 ${name} 失败`);
  }
  const result = await res.json();
  return handleAuthError(result || {});
}

/**
 * 调用云函数（自动附带 token）
 * 优先使用 SDK callFunction；匿名登录未开启时自动降级为 HTTP 调用。
 * 所有异常统一包装抛出，避免 SDK 静默失败吞掉错误。
 */
export async function callFunction(name, data = {}) {
  // 确保 SDK 已初始化（触发匿名登录尝试）
  getApp();
  if (_authReady) {
    await _authReady;
  }

  // 匿名登录成功 → 走 SDK
  if (!_authFailed) {
    try {
      return await callFunctionBySDK(name, data);
    } catch (e) {
      // SDK 调用失败（非匿名登录问题），降级 HTTP
      if (e.message !== 'anonymous_login_disabled') {
        // eslint-disable-next-line no-console
        console.warn(`[CloudBase] SDK 调用 ${name} 失败，降级 HTTP：`, e.message);
      }
    }
  }

  // 降级：HTTP 调用
  try {
    return await callFunctionByHttp(name, data);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[CloudBase] callFunction(${name}) 失败：`, e);
    throw new Error(
      e.message ||
        `${name} 调用失败。请确认：1）云环境已开启匿名登录，或 2）已为云函数开启 HTTP 访问服务。`
    );
  }
}

/**
 * 将 cloud:// fileID 转换为浏览器可访问的 HTTPS 临时链接
 * 浏览器不识别 cloud:// 协议，必须通过 CloudBase SDK 获取临时 URL。
 * 支持单个 fileID 或 fileID 数组。
 */
export async function getTempFileURL(fileID) {
  if (!fileID) return '';
  // 已经是 http(s) 链接，直接返回
  if (typeof fileID === 'string' && /^https?:\/\//i.test(fileID)) return fileID;

  const app = getApp();
  if (_authReady) {
    await _authReady;
  }
  if (_authFailed) {
    // 匿名登录失败时 SDK 不可用，返回空字符串（由调用方决定降级展示）
    return '';
  }

  const isArray = Array.isArray(fileID);
  const list = isArray ? fileID : [fileID];

  try {
    const res = await app.getTempFileURL({ fileList: list });
    const urlMap = {};
    (res.fileList || []).forEach((item) => {
      urlMap[item.fileID] = item.tempFileURL || '';
    });
    return isArray ? list.map((id) => urlMap[id] || '') : urlMap[fileID] || '';
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[CloudBase] getTempFileURL 失败：', e.message);
    return isArray ? list.map(() => '') : '';
  }
}

export default {
  getApp,
  getToken,
  setToken,
  setAdminInfo,
  getAdminInfo,
  clearAuth,
  callFunction,
  getTempFileURL,
};
