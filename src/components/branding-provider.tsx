"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import type { Branding } from "@/lib/branding/types";
import type { BrandingContextValue } from "./branding-provider-types";
import { DEFAULT_BRANDING, fetchBranding } from "./branding-provider-utils";

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children, initialBranding }: { children: React.ReactNode; initialBranding?: Branding }) {
	const query = useQuery({ queryKey: ["branding"], queryFn: fetchBranding, refetchOnMount: "always", staleTime: 0, initialData: initialBranding ?? DEFAULT_BRANDING });
	const branding = query.data;
	const [iconVersion, setIconVersion] = useState(0);

	async function refreshBranding() {
		const refreshed = await query.refetch();
		if (refreshed.error) throw refreshed.error;
		const nextBranding = refreshed.data ?? branding;
		setIconVersion(Date.now());
		if (document.title === "Mailflare" || document.title === branding.appName) {
			document.title = nextBranding.appName;
		}
	}


	return (
		<BrandingContext.Provider value={{
			...branding,
			iconUrl: branding.hasCustomIcon ? `/api/branding/icon?v=${iconVersion}` : "/icon-96.png",
			refreshBranding,
		}}>
			{children}
		</BrandingContext.Provider>
	);
}

export function useBranding() {
	return useContext(BrandingContext) ?? {
		...DEFAULT_BRANDING,
		iconUrl: "/icon-96.png",
		refreshBranding: async () => undefined,
	};
}
