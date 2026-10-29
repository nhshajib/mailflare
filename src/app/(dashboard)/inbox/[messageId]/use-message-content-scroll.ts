import { useResettableState } from "@/hooks/use-resettable-state";
import { useEffect, useRef, useState } from "react";

export function useMessageContentScroll(messageId: string, loading: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useResettableState(messageId, false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [messageId]);

  function handleScroll() {
    setScrolled((scrollRef.current?.scrollTop ?? 0) > 0);
  }

  return { scrollRef, scrolled, handleScroll };
}
