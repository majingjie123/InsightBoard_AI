import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  options,
  error,
  className = '',
  disabled,
  placeholder,
  ...props
}, ref) => {
  return (
    <div className="w-full flex flex-col gap-1 text-left">
      {label && (
        <label className="text-xs font-semibold text-slate-500 select-none">
          {label}
        </label>
      )}
      <select
        {...props}
        ref={ref}
        disabled={disabled}
        className={`w-full px-3 py-2 text-xs border rounded bg-white text-slate-700 outline-none transition-all focus:outline-none focus:ring-1 ${
          error 
            ? 'border-red-500 focus:ring-red-500' 
            : 'border-slate-200 focus:ring-blue-500 focus:border-blue-500'
        } disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-[10px] text-red-500 leading-tight">
          {error}
        </span>
      )}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
