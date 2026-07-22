'use client';

import React, { memo } from 'react';
import { Store } from 'lucide-react';

interface AppLogoProps {
  src?: string;
  iconName?: string;
  size?: number;
  className?: string;
  onClick?: () => void;
}

const AppLogo = memo(function AppLogo({
  size = 64,
  className = '',
  onClick,
}: AppLogoProps) {
  const iconSize = Math.round(size * 0.65);
  return (
    <div
      className={`flex items-center justify-center rounded-lg bg-primary/15 flex-shrink-0 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      <Store size={iconSize} className="text-primary" />
    </div>
  );
});

AppLogo.displayName = 'AppLogo';

export default AppLogo;
