'use client';
import dynamic from 'next/dynamic';
import React from 'react';
import AppLayout from '@/components/AppLayout';

const ProductManagementScreen = dynamic(
  () => import('./components/ProductManagementScreen'),
  { ssr: false, loading: () => (
    <div className="space-y-4">
      <div className="h-20 rounded-xl bg-secondary/40 animate-pulse" />
      <div className="h-12 rounded-xl bg-secondary/40 animate-pulse" />
      <div className="h-96 rounded-xl bg-secondary/40 animate-pulse" />
    </div>
  )}
);

export default function ProductManagementPage() {
  return (
    <AppLayout currentPath="/product-management">
      <ProductManagementScreen />
    </AppLayout>
  );
}