import React, { useEffect, useState } from 'react';
// Fix: Import AlertTriangleIcon to use for warning notifications.
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon } from './Icons';

export interface ToastProps {
  id?: number;
  message: string;
  // Fix: Add 'warning' type to support warning notifications.
  type: 'success' | 'error' | 'warning';
  onClose?: () => void;
}

const toastConfig = {
  success: {
    icon: <CheckCircleIcon />,
    bgClass: 'bg-green-100 border-green-400 text-green-700',
  },
  error: {
    icon: <XCircleIcon />,
    bgClass: 'bg-red-100 border-red-400 text-red-700',
  },
  // Fix: Add configuration for 'warning' toasts to support a new notification type.
  warning: {
    icon: <AlertTriangleIcon className="h-6 w-6 text-yellow-700" />,
    bgClass: 'bg-yellow-100 border-yellow-400 text-yellow-700',
  },
};

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      const exitTimer = setTimeout(onClose!, 300); // Wait for animation to finish
      return () => clearTimeout(exitTimer);
    }, 4000); // 4 seconds before auto-dismiss

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose!, 300);
  };
  
  const config = toastConfig[type];

  return (
    <div
      role="alert"
      className={`max-w-sm w-full rounded-lg shadow-lg p-4 flex items-center space-x-4 border ${config.bgClass} ${isExiting ? 'animate-toast-out' : 'animate-toast-in'}`}
    >
      <div className="flex-shrink-0">{config.icon}</div>
      <div className="flex-1 font-medium">{message}</div>
      <button onClick={handleClose} aria-label="Fermer" className="text-xl hover:opacity-75">&times;</button>
    </div>
  );
};
