"use client";

import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

/** Local edits belong to a specific server value/entity. Reset them during the
 * render that changes that identity, before children can observe stale state.
 * Use a stable primitive reset key; never an object allocated during render.
 */
export function useResettableState<T>(resetKey: string | number | boolean | null | undefined, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [snapshot, setSnapshot] = useState({ key: resetKey, value: initialValue });
  if (!Object.is(snapshot.key, resetKey)) {
    setSnapshot({ key: resetKey, value: initialValue });
  }
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((update) => {
    setSnapshot(previous => ({ ...previous, value: typeof update === "function" ? (update as (value: T) => T)(previous.value) : update }));
  }, []);
  return [Object.is(snapshot.key, resetKey) ? snapshot.value : initialValue, setValue];
}
