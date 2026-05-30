import React, { useState, useEffect, useRef } from 'react';

export interface ContextMenuItem {
  key: string;
  label: React.ReactNode;
  onClick: () => void;
  className?: string;
}

export interface ContextMenuProps {
  children: React.ReactNode;
  items: ContextMenuItem[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  children,
  items
}) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // 处理右键触发
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setVisible(true);
    setPosition({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleClick = () => setVisible(false);
    const handleScroll = () => setVisible(false);

    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div onContextMenu={handleContextMenu} className="w-full h-full">
      {children}
      
      {visible && (
        <div
          ref={menuRef}
          style={{ top: position.y, left: position.x }}
          className="fixed bg-white border border-slate-200 shadow-xl rounded py-1 w-36 z-50 transition-opacity"
        >
          {items.map((item) => (
            <button
              key={item.key}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                setVisible(false);
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

export default ContextMenu;
