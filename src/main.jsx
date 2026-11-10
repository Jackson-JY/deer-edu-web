import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ConfigProvider, Grid } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import App from './App';
import './styles.css';

dayjs.locale('zh-cn');

// 设计系统对齐小程序（app.wxss）：Apple 设计语言 + 品牌薄荷绿
// 主题 Token 为「主干」，组件级细节补充放在 styles.css
const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif";

const theme = {
  token: {
    // 品牌
    colorPrimary: '#12B7A8',
    colorInfo: '#12B7A8',
    colorLink: '#0E8C81',
    colorLinkHover: '#12B7A8',
    colorSuccess: '#34C759',
    colorWarning: '#FF9500',
    colorError: '#FF3B30',
    // 中性色（Apple System Gray）
    colorText: '#1D1D1F',
    colorTextSecondary: '#6E6E73',
    colorTextTertiary: '#8E8E93',
    colorBorder: '#E5E5EA',
    colorBorderSecondary: '#EFEFF2',
    colorBgLayout: '#F5F5F7',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    // 形态
    borderRadius: 10,
    fontFamily: FONT_FAMILY,
    wireframe: false,
  },
  components: {
    // 胶囊按钮：无投影，按压反馈见 styles.css
    Button: {
      borderRadius: 999,
      borderRadiusLG: 999,
      borderRadiusSM: 999,
      controlHeight: 36,
      controlHeightLG: 42,
      fontWeight: 500,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
    },
    // 卡片：细边框 + 极克制阴影
    Card: {
      borderRadiusLG: 14,
      boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
      paddingLG: 20,
    },
    // 表格：浅灰表头、透明分割、薄荷悬停
    Table: {
      headerBg: '#FAFAFB',
      headerColor: '#6E6E73',
      headerSplitColor: 'transparent',
      rowHoverBg: 'rgba(18, 183, 168, 0.06)',
      borderColor: '#EFEFF2',
      headerBorderRadius: 10,
    },
    // 侧边导航：白底 + 薄荷选中
    Menu: {
      itemBorderRadius: 10,
      itemColor: '#1D1D1F',
      itemHoverBg: 'rgba(0, 0, 0, 0.04)',
      itemSelectedBg: 'rgba(18, 183, 168, 0.12)',
      itemSelectedColor: '#0E8C81',
      itemHeight: 44,
      iconSize: 16,
    },
    Layout: {
      siderBg: '#FFFFFF',
      headerBg: '#FFFFFF',
      bodyBg: '#F5F5F7',
      triggerBg: '#FFFFFF',
    },
    Input: { borderRadius: 10, activeShadow: 'none' },
    InputNumber: { borderRadius: 10 },
    Select: { borderRadius: 10 },
    DatePicker: { borderRadius: 10 },
    TimePicker: { borderRadius: 10 },
    // 分段控制器：胶囊轨道
    Segmented: {
      borderRadius: 999,
      trackPadding: 3,
      itemSelectedBg: '#FFFFFF',
      itemColor: '#6E6E73',
      itemSelectedColor: '#1D1D1F',
    },
    Modal: { borderRadiusLG: 18 },
    Drawer: { borderRadiusLG: 0 },
    Tag: { defaultBg: '#F2F2F7', defaultColor: '#6E6E73' },
    Tabs: { titleColor: '#8E8E93', titleSelectedColor: '#1D1D1F', titleFontSize: 14, horizontalMargin: '0 24px' },
    Progress: { remainingColor: '#EFEFF2' },
    Switch: { colorPrimary: '#12B7A8', colorPrimaryHover: '#0E8C81' },
    Checkbox: { colorPrimary: '#12B7A8', colorPrimaryHover: '#0E8C81' },
    Radio: { colorPrimary: '#12B7A8', colorPrimaryHover: '#0E8C81' },
    Spin: { colorPrimary: '#12B7A8' },
    Tooltip: { borderRadius: 8 },
    Popover: { borderRadiusLG: 12 },
  },
};

/**
 * 用 ConfigProvider 全局注入响应式默认值：
 * - Modal：桌面 520，手机 95vw
 * - Drawer：桌面 520（学生详情）/ 520（班级管理），手机 92vw
 * - Table：所有表格横向可滚动
 * 各页面传的 props 会覆盖这里的默认值。
 */
function ResponsiveProvider({ children }) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;

  return (
    <ConfigProvider
      locale={zhCN}
      theme={theme}
      modalProps={{ width: isMobile ? '95vw' : 520, ...(isMobile ? { centered: true, top: 16 } : {}) }}
      drawerProps={{ width: isMobile ? '92vw' : undefined, placement: 'right' }}
      tableProps={{ scroll: { x: 'max-content' } }}
    >
      {children}
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ResponsiveProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </ResponsiveProvider>
  </React.StrictMode>
);
