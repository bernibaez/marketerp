import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import InvoiceSettingsTab from './settings/InvoiceSettingsTab';

export default function InvoiceSettingsPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 min-h-screen">
        <InvoiceSettingsTab
          showBackButton={true}
          onBack={() => navigate('/settings')}
        />
      </div>
    </AppLayout>
  );
}
