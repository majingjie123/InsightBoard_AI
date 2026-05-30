import React, { useState, useRef, useEffect } from 'react';

export interface DropdownItem {
  key: string;
  label: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 监听点击外部区域以收起下拉菜单
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const alignStyles = {
    left: 'left-0 origin-top-left',
    right: 'right-0 origin-top-right'
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div className={`absolute mt-1.5 w-40 rounded bg-white shadow-lg border border-slate-200/80 py-1 z-50 transition-all ${alignStyles[align]}`}>
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                item.onClick?.();
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center ${item.className || ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
