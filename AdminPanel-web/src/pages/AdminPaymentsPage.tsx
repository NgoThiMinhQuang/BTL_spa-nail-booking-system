import { useState } from 'react';
import { useApp } from '../store';
import { Icon } from '../components/Icon';
import { formatVND } from '../lib/utils';

export function AdminPaymentsPage() {
  const { state } = useApp();

  // Mock data for the table based on the image
  const transactions = [
    { id: '#BK1024', customer: 'Sarah Johnson', date: 'Sep 29, 2026', total: 45, deposit: 10, remaining: 35, status: 'Paid' },
    { id: '#BK1025', customer: 'Chloe Martin', date: 'Sep 29, 2026', total: 65, deposit: 15, remaining: 50, status: 'Pending' },
    { id: '#BK1027', customer: 'Isabella Lee', date: 'Sep 29, 2026', total: 85, deposit: 20, remaining: 65, status: 'Pending' },
    { id: '#BK1028', customer: 'Grace Kim', date: 'Sep 28, 2026', total: 45, deposit: 10, remaining: 35, status: 'Paid' },
    { id: '#BK1019', customer: 'Lily Walker', date: 'Sep 27, 2026', total: 30, deposit: 0, remaining: 0, status: 'Refunded' },
  ];

  return (
    <div style={{ paddingTop: '8px' }}>
      {/* Top Controls: Date Picker & Export */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: '28px',
        gap: '16px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '8px 16px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
          border: '1px solid #F1F5F9',
          gap: '12px',
          fontSize: '13px',
          color: '#64748B',
          fontWeight: 500
        }}>
          <span>From</span>
          <span style={{ color: '#0F172A', fontWeight: 600 }}>20/09/2026 📅</span>
          <span>To</span>
          <span style={{ color: '#0F172A', fontWeight: 600 }}>29/09/2026 📅</span>
        </div>
        <button style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)',
          color: '#FFFFFF',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '24px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)'
        }}>
          📥 Export CSV
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Total Revenue Card */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px', background: '#FCE7F3', color: '#E11D48',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
          }}>
            📈
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Total Revenue</div>
            <div style={{ fontSize: '36px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>$340.00</div>
            <div style={{ fontSize: '13px', color: '#94A3B8' }}>From 5 paid bookings in range</div>
          </div>
        </div>

        {/* Pending Deposits Card */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px', background: '#FEF3C7', color: '#D97706',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
          }}>
            🕒
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Pending Deposits</div>
            <div style={{ fontSize: '36px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>$50.00</div>
            <div style={{ fontSize: '13px', color: '#94A3B8' }}>3 bookings awaiting settlement</div>
          </div>
        </div>
      </div>

      {/* Transaction History Table */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        padding: '28px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
      }}>
        <h2 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>Transaction History</h2>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 700, color: '#64748B', borderBottom: '1px solid #F1F5F9', textTransform: 'uppercase' }}>Booking ID</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 700, color: '#64748B', borderBottom: '1px solid #F1F5F9', textTransform: 'uppercase' }}>Customer</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 700, color: '#64748B', borderBottom: '1px solid #F1F5F9', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 700, color: '#64748B', borderBottom: '1px solid #F1F5F9', textTransform: 'uppercase' }}>Service Total</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 700, color: '#64748B', borderBottom: '1px solid #F1F5F9', textTransform: 'uppercase' }}>Deposit Paid</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 700, color: '#64748B', borderBottom: '1px solid #F1F5F9', textTransform: 'uppercase' }}>Remaining</th>
                <th style={{ padding: '16px', fontSize: '12px', fontWeight: 700, color: '#64748B', borderBottom: '1px solid #F1F5F9', textTransform: 'uppercase' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, idx) => (
                <tr key={idx} style={{ borderBottom: idx < transactions.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <td style={{ padding: '20px 16px', fontSize: '14px', fontWeight: 600, color: '#E11D48' }}>{tx.id}</td>
                  <td style={{ padding: '20px 16px', fontSize: '14px', fontWeight: 500, color: '#334155' }}>{tx.customer}</td>
                  <td style={{ padding: '20px 16px', fontSize: '14px', color: '#64748B' }}>{tx.date}</td>
                  <td style={{ padding: '20px 16px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>${tx.total.toFixed(2)}</td>
                  <td style={{ padding: '20px 16px', fontSize: '14px', color: '#64748B' }}>${tx.deposit.toFixed(2)}</td>
                  <td style={{ padding: '20px 16px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>${tx.remaining.toFixed(2)}</td>
                  <td style={{ padding: '20px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: tx.status === 'Paid' ? '#DCFCE7' : tx.status === 'Pending' ? '#FEF3C7' : '#FEE2E2',
                      color: tx.status === 'Paid' ? '#16A34A' : tx.status === 'Pending' ? '#D97706' : '#DC2626'
                    }}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
