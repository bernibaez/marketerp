import React from 'react';
import type { Product } from '@/lib/initialProducts';
import LabelPrintDialog from '@/components/LabelPrintDialog';

export interface PriceLabelModalProps {
  products: Product[];
  onClose: () => void;
}

/**
 * PriceLabelModal delega en LabelPrintDialog para ofrecer:
 * - Selección de formatos EAN-13, EAN-8, UPC-A, Code 128
 * - Tamaños predefinidos (50x30, 40x25, 58mm y 80mm térmicos continuos, cuadrícula A4) y personalizados
 * - Jerarquía visual con precio dominante
 * - Vista previa a escala real (mm a px)
 * - Impresión física nítida (@media print, crispEdges SVG) y descarga directa en PDF
 */
export default function PriceLabelModal({ products, onClose }: PriceLabelModalProps) {
  return (
    <LabelPrintDialog
      products={products}
      onClose={onClose}
      isOpen={true}
    />
  );
}
