import {
  Package,
  Inbox,
  FileX,
  Database,
  Search,
  AlertCircle,
  Users,
  ShoppingBag,
  Clock,
  History,
  Folder,
  Receipt,
  Factory,
  ClipboardList,
  ShieldAlert,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Package,
  Inbox,
  FileX,
  Database,
  Search,
  AlertCircle,
  Users,
  ShoppingBag,
  Clock,
  History,
  Folder,
  Receipt,
  Factory,
  ClipboardList,
  ShieldAlert,
};

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const IconComp = icon ? ICON_MAP[icon] : null;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      {IconComp && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <IconComp size={32} className="text-slate-400" />
        </div>
      )}
      <h3 className="text-base font-black text-slate-700">{title}</h3>
      {description && (
        <p className="text-sm font-medium text-slate-400 mt-1 max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-5 py-2 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
