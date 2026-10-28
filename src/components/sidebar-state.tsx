"use client";

import { useHydrated } from "@/hooks/use-hydrated";
import { useResettableState } from "@/hooks/use-resettable-state";
import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchCurrentUser } from "@/hooks/use-current-user";
import { readColumnWidth, readInitialColumnWidth, saveColumnWidth } from "./column-width-preferences";
import { isMobileViewport, useIsMobile } from "./sidebar-mobile-utils";
import { readInitialSidebarMinimal, saveInitialSidebarMinimal, syncInitialSidebarWidth } from "./sidebar-state-utils";
import type { SidebarProviderProps, SidebarState } from "./sidebar-state-types";

const SidebarContext = createContext<SidebarState>({ minimal: false, width: 260, userId: null, toggle: () => undefined, setWidth: () => undefined, setForcedMinimal: () => undefined, mobile: false, mobileOpen: false });

export function SidebarProvider({ children, expandedWidth = 260, mobileOverlay = false }: SidebarProviderProps) {
	const hydrated = useHydrated();
	const pathname = usePathname();
	const mobile = useIsMobile();
	const [minimal, setMinimal] = useResettableState(`${hydrated}:${mobile}:${mobile ? pathname : ""}`, mobile ? true : hydrated ? readInitialSidebarMinimal() : false);
	const [forcedMinimal, setForcedMinimal] = useState(false);
	const [width, setWidth] = useResettableState(`${hydrated}:${expandedWidth}`, hydrated ? readInitialColumnWidth("sidebar", expandedWidth, 200, 480) : expandedWidth);
	const widthReady = hydrated;
	const [userId, setUserId] = useState<string | null>(null);
	const [storageKey, setStorageKey] = useState<string | null>(null);
	const [mobileOpen, setMobileOpen] = useResettableState(`${pathname}:${mobile}`, false);
	// Overlay layouts have no minified rail on phones: the menu is either fully shown over the page or hidden.
	const overlay = mobileOverlay && mobile;

	useLayoutEffect(() => {
		syncInitialSidebarWidth(width, minimal);
	}, [width, minimal]);

	useEffect(() => {
		// The sidebar preference is cosmetic, so every failure here degrades to the default.
		void fetchCurrentUser()
			.then((user) => {
				const userId = user?.id;
					if (!userId) return;
					setUserId(userId);
					const key = `mailflare-sidebar-minimal:${userId}`;
				setStorageKey(key);
		if (isMobileViewport()) return;
				try {
						const storedMinimal = localStorage.getItem(key);
						const savedMinimal = storedMinimal === null ? readInitialSidebarMinimal() : storedMinimal === "true";
						setMinimal(savedMinimal);
						saveInitialSidebarMinimal(savedMinimal);
						localStorage.setItem(key, String(savedMinimal));
						const savedWidth = readColumnWidth(userId, "sidebar", readInitialColumnWidth("sidebar", expandedWidth, 200, 480), 200, 480);
						setWidth(savedWidth);
						saveColumnWidth(userId, "sidebar", savedWidth);
				} catch {
					// Storage can be unavailable in private windows; keep the default.
				}
			})
			.catch(() => undefined);
	}, []);

	function toggle() {
		if (overlay) {
			setMobileOpen((current) => !current);
			return;
		}
		if (forcedMinimal) {
			setForcedMinimal(false);
			setMinimal(false);
			if (!isMobileViewport()) {
				saveInitialSidebarMinimal(false);
				if (storageKey) localStorage.setItem(storageKey, "false");
			}
			return;
		}
		setMinimal((current) => {
			const next = !current;
			if (!isMobileViewport()) {
				saveInitialSidebarMinimal(next);
				if (storageKey) localStorage.setItem(storageKey, String(next));
			}
			return next;
		});
	}

	return (
		<SidebarContext.Provider value={{ minimal: !overlay && (minimal || forcedMinimal), width, userId, toggle, setWidth, setForcedMinimal, mobile: overlay, mobileOpen }}>
			<div className="h-full" style={{ "--sidebar-width": widthReady ? `${minimal || forcedMinimal ? 72 : width}px` : `var(--persisted-sidebar-width, ${expandedWidth}px)`, "--sidebar-transition-duration": widthReady ? "200ms" : "0ms" } as React.CSSProperties}>
				{children}
			</div>
		</SidebarContext.Provider>
	);
}

export function useSidebar() {
	return useContext(SidebarContext);
}
