import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'normal' | 'sm';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'normal', isLoading = false, className = '', ...props }) => {
  const baseClasses = 'font-bold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transform hover:scale-105 active:scale-100';

  const variantClasses = {
    primary: 'bg-primary text-primary-content hover:bg-primary-focus focus:ring-primary',
    secondary: 'bg-secondary text-neutral hover:bg-secondary-focus focus:ring-secondary',
    danger: 'bg-error text-white hover:bg-red-700 focus:ring-error',
  };
  
  const sizeClasses = {
    normal: 'py-2 px-4',
    sm: 'py-1 px-2 text-sm',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
};