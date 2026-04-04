import type { SummaryPayload } from "../dashboard/types";

interface SummaryCardProps {
  payload: SummaryPayload;
}

export function SummaryCard({ payload }: SummaryCardProps): JSX.Element {
  return <p className="summary-copy">{payload.text}</p>;
}
