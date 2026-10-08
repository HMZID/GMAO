import { Badge } from "@/components/ui/primitives";
import { CRITICALITY, DUE_STATUS, EQUIPMENT_STATUS, PRIORITY, READING_STATUS, REQUEST_STATUS, TASK_RESULT, WORK_ORDER_STATUS } from "@/lib/labels";

export function EquipmentStatusBadge({ status }: { status: string }) {
  const s = EQUIPMENT_STATUS[status] ?? { label: status, tone: "gray" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function CriticalityBadge({ value }: { value: string }) {
  const c = CRITICALITY[value] ?? { label: value, tone: "gray" as const };
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

export function PriorityBadge({ value, short = false }: { value: string | null | undefined; short?: boolean }) {
  if (!value) return <Badge>—</Badge>;
  const p = PRIORITY[value] ?? { label: value, short: value, tone: "gray" as const };
  return <Badge tone={p.tone}>{short ? p.short : p.label}</Badge>;
}

export function WorkOrderStatusBadge({ status }: { status: string }) {
  const s = WORK_ORDER_STATUS[status] ?? { label: status, tone: "gray" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function RequestStatusBadge({ status }: { status: string }) {
  const s = REQUEST_STATUS[status] ?? { label: status, tone: "gray" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function DueStatusBadge({ status }: { status: string }) {
  const s = DUE_STATUS[status] ?? { label: status, tone: "gray" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function ReadingStatusBadge({ status }: { status: string }) {
  const s = READING_STATUS[status] ?? { label: status, tone: "gray" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function TaskResultBadge({ result }: { result: string | null }) {
  if (!result) return <Badge>À faire</Badge>;
  const r = TASK_RESULT[result] ?? { label: result, tone: "gray" as const };
  return <Badge tone={r.tone}>{r.label}</Badge>;
}
