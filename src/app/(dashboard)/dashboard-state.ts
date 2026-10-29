"use client";

import { useHydrated } from "@/hooks/use-hydrated";
import { useResettableState } from "@/hooks/use-resettable-state";
import { useEffect, useLayoutEffect, useState } from "react";
import { fetchCurrentUser } from "@/hooks/use-current-user";
import { readInitialAssistantPanelState, saveAssistantPanelState } from "./dashboard-state-utils";

export function useDashboardState() {
	const hydrated = useHydrated();
	const initial = hydrated ? readInitialAssistantPanelState() : { open: false, fullSize: false };
	const [assistantOpen, setAssistantOpen] = useResettableState(hydrated, initial.open);
	const [assistantFullSize, setAssistantFullSize] = useResettableState(hydrated, initial.fullSize);
	const panelRestored = hydrated;
	const [storagePrefix, setStoragePrefix] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void fetchCurrentUser().then((user) => {
			if (cancelled || !user?.id) return;
			const prefix = `mailflare-dashboard:${user.id}`;
			try {
				const savedOpen = localStorage.getItem(`${prefix}:assistant-open`);
				const savedFullSize = localStorage.getItem(`${prefix}:assistant-full-size`);
				const initial = readInitialAssistantPanelState();
				setAssistantOpen(savedOpen === null ? initial.open : savedOpen === "true");
				setAssistantFullSize(savedFullSize === null ? initial.fullSize : savedFullSize === "true");
			} catch { /* Storage is optional. */ }
			setStoragePrefix(prefix);
		}).catch(() => undefined);
		return () => { cancelled = true; };
	}, []);

	useEffect(() => {
		if (!panelRestored) return;
		saveAssistantPanelState(assistantOpen, assistantFullSize, storagePrefix);
	}, [panelRestored, storagePrefix, assistantOpen, assistantFullSize]);

	return { assistantOpen, setAssistantOpen, assistantFullSize, setAssistantFullSize };
}
