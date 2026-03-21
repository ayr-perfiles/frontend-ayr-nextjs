interface WeightIndicatorProps {
  current: number;
  initial: number;
}

export function WeightIndicator({ current, initial }: WeightIndicatorProps) {
  const percentage = Math.max(0, Math.min(100, (current / initial) * 100)) || 0;

  let colorClass = "bg-green-500";
  if (percentage === 0) colorClass = "bg-gray-300";
  else if (percentage <= 25) colorClass = "bg-red-500";
  else if (percentage <= 50) colorClass = "bg-orange-500";

  return (
    <div className="w-full min-w-[140px]">
      <div className="flex justify-between items-end text-xs mb-1.5">
        <span className="font-bold text-gray-800 text-sm">{current} kg</span>
        <span className="text-gray-400 font-medium">/ {initial}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
