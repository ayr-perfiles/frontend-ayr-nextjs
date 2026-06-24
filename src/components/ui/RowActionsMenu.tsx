import React, { useState, useRef, useEffect, useLayoutEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Loader2 } from "lucide-react";

export interface RowAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger" | "warning";
  disabled?: boolean;
  loading?: boolean;
  hidden?: boolean;
  section?: string;
}

interface RowActionsMenuProps {
  trigger?: ReactNode;
  items: RowAction[];
  align?: "right" | "left";
  menuWidth?: number;
}

export function RowActionsMenu({
  trigger,
  items,
  align = "right",
  menuWidth = 208, // w-52
}: RowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, right: 0, useRight: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (isOpen && buttonRef.current && menuRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = menuRef.current.offsetHeight;
      const spacing = 4;
      const padding = 8;

      let top = rect.bottom + window.scrollY + spacing;
      let left = rect.left + window.scrollX;
      let right = window.innerWidth - rect.right;
      let useRight = align === "right";

      // Vertical Flip
      if (rect.bottom + menuHeight + spacing > window.innerHeight) {
        top = rect.top + window.scrollY - menuHeight - spacing;
      }

      // Horizontal Clamp & Flip
      if (useRight) {
        if (window.innerWidth - right < menuWidth + padding) {
          // No cabe a la derecha, intentar alinear a la izquierda
          useRight = false;
          left = Math.max(padding, left);
        } else {
          right = Math.max(padding, right);
        }
      } else {
        if (left + menuWidth + padding > window.innerWidth) {
          // No cabe a la izquierda, intentar alinear a la derecha
          useRight = true;
          right = Math.max(padding, window.innerWidth - rect.right);
        } else {
          left = Math.max(padding, left);
        }
      }

      setMenuPosition({ top, left, right, useRight });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEvents = () => setIsOpen(false);
    const handleResize = () => updatePosition();

    window.addEventListener("click", handleEvents);
    window.addEventListener("scroll", handleEvents, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("click", handleEvents);
      window.removeEventListener("scroll", handleEvents, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  // Group items by section
  const visibleItems = items.filter(item => !item.hidden);
  const sections: { [key: string]: RowAction[] } = {};
  const sectionOrder: string[] = [];

  visibleItems.forEach(item => {
    const sectionName = item.section || "default";
    if (!sections[sectionName]) {
      sections[sectionName] = [];
      sectionOrder.push(sectionName);
    }
    sections[sectionName].push(item);
  });

  const variantClasses = {
    default: "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
    primary: "text-blue-600 hover:bg-blue-50 hover:text-blue-700",
    danger: "text-red-600 hover:bg-red-50 hover:text-red-700",
    warning: "text-orange-600 hover:bg-orange-50 hover:text-orange-700",
  };

  return (
    <div className="relative flex justify-center">
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className={`p-2 rounded-lg transition-all ${
          isOpen ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:bg-slate-100 hover:text-blue-600"
        }`}
      >
        {trigger || <MoreHorizontal size={20} />}
      </button>

      {mounted &&
        isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="absolute bg-white border border-slate-100 rounded-xl shadow-2xl z-[9999] py-2 animate-in fade-in zoom-in-95 overflow-hidden"
            style={{
              width: menuWidth,
              top: menuPosition.top,
              ...(menuPosition.useRight
                ? { right: menuPosition.right }
                : { left: menuPosition.left }),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {sectionOrder.map((sectionName, sIdx) => (
              <React.Fragment key={sectionName}>
                {sIdx > 0 && <div className="h-px bg-slate-100 my-1 mx-2" />}
                {sections[sectionName].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (!item.disabled && !item.loading) {
                        item.onClick();
                        setIsOpen(false);
                      }
                    }}
                    disabled={item.disabled || item.loading}
                    className={`w-full text-left px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50 ${
                      variantClasses[item.variant || "default"]
                    }`}
                  >
                    {item.loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      item.icon
                    )}
                    {item.label}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
