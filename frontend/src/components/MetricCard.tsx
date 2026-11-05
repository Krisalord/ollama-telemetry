import React from 'react';

interface MetricCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export function MetricCard({ title, icon, children }: MetricCardProps) {
  return (
    <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>{title}</span>
        {icon}
      </div>
      {children}
    </div>
  );
}
