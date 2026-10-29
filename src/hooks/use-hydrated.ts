"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;
/** SSR and the first hydration render agree; browser-only values are read only afterwards. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
