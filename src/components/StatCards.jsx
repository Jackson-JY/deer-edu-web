import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';

/**
 * 统计卡组（Dashboard / Grants / Students 共用）
 * items: [{ title, value, icon, color?, key? }]
 * colProps: 透传给 Col 的栅格属性，默认 { xs: 12, sm: 8, lg: 4 }
 */
export default function StatCards({ items, colProps }) {
  const cp = colProps || { xs: 12, sm: 8, lg: 4 };
  return (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      {items.map((it) => (
        <Col key={it.key || it.title} {...cp}>
          <Card className="stat-card">
            <Statistic
              title={it.title}
              value={it.value ?? 0}
              prefix={it.icon ? <span className="stat-icon">{it.icon}</span> : undefined}
              valueStyle={it.color ? { color: it.color } : undefined}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
