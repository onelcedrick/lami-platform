import { statusColor } from "@/lib/types";

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(status)}`}
    >
      {label || status}
    </span>
  );
}
