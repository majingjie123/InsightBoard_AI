import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  className = '',
  disabled,
  ...props
}, ref) => {
  return (
    <div className="w-full flex flex-col gap-1 text-left">
      {label && (
        <label className="text-xs font-semibold text-slate-500 select-none">
          {label}
        </label>
      )}
      <input
        {...props}
        ref={ref}
        disabled={disabled}
        className={`w-full px-3 py-2 text-xs border rounded bg-white text-slate-700 outline-none transition-all placeholder-slate-400 focus:outline-none focus:ring-1 ${
          error 
            ? 'border-red-500 focus:ring-red-500' 
            : 'border-slate-200 focus:ring-blue-500 focus:border-blue-500'
        } disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`}
      />
      {error && (
        <span className="text-[10px] text-red-500 leading-tight">
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
