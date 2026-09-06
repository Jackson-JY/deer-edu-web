// 全局配置（部署前需按实际情况填写）

// 云环境 ID（与小程序共用）
export const ENV_ID = 'cloud1-d7g66xvli7bb6bcc6';

// 微信开放平台「网站应用」AppID
// 用于构造扫码登录 URL；留空时登录页会提示先配置，并提供开发模式登录。
export const WX_APPID = '';

// 授权回调地址（需与开放平台「授权回调域」一致）
// CloudBase 静态托管下通常为：https://你的域名/index.html#/auth/callback
export function getWxRedirectUri() {
  const { origin, pathname } = window.location;
  const base = pathname.endsWith('/') ? pathname : pathname.split('/').slice(0, -1).join('/') + '/';
  return `${origin}${base}index.html#/auth/callback`;
}
