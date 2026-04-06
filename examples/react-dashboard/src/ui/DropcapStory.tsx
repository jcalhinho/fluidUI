import type { CSSProperties } from "react";
import type { DropcapPayload } from "../dashboard/types";

interface DropcapStoryProps {
  payload: DropcapPayload;
}

export function DropcapStory({ payload }: DropcapStoryProps): JSX.Element {
  return (
    <article className="dropcap-article" style={{ "--dropcap-accent": payload.accent ?? "#1e3a8a" } as CSSProperties}>
      <p>{payload.text}</p>
    </article>
  );
}
