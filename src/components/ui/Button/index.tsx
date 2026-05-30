import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  // 卫语句：拦截 loading 时的 click
  const handleOnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) {
      e.preventDefault();
      return;
    }
    props.onClick?.(e);
  };

  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded transition-all outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/10 active:scale-[0.98]',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 active:scale-[0.98]',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/10 active:scale-[0.98]',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-800',
    success: 'bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-500/10 active:scale-[0.98]'
  };

  const sizeStyles = {
    sm: 'text-[11px] px-3 py-1.5 gap-1',
    md: 'text-xs px-4 py-2 gap-1.5',
    lg: 'text-sm px-5 py-2.5 gap-2'
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      onClick={handleOnClick}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;
