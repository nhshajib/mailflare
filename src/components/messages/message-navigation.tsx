"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { primeMessageDetail } from "@/lib/messages/detail-cache";
import type { Message } from "@/hooks/types";
import type { MessageNavigationState } from "./message-navigation-types";

export function useMessageNavigation(href: string, message: Message): MessageNavigationState {
	const pathname = usePathname();
	const router = useRouter();
	const [startedPath, setStartedPath] = useState<string | null>(null);
	const [progress, setProgress] = useState<number | null>(null);

	useEffect(() => {
		if (progress === null || startedPath === pathname) return;
		const timer = window.setTimeout(() => setProgress(null), 220);
		return () => window.clearTimeout(timer);
	}, [pathname, startedPath, progress]);

	function onNavigate(event: MouseEvent<HTMLAnchorElement>, markRead = false) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		primeMessageDetail({ ...message, read: markRead || message.read });
		setStartedPath(pathname);
		setProgress(12);
		try {
			router.push(href);
		} catch {
			setProgress(null);
		}
	}

	return { progress: progress !== null && startedPath !== pathname ? 100 : progress, onNavigate };
}

export function MessageNavigationProgress({ progress }: { progress: number | null }) {
	if (progress === null) return null;
	return (
		<div className="fixed inset-x-0 top-0 z-[120] h-1 bg-blue-100">
			<div className="h-full bg-blue-600 transition-[width] duration-100 ease-out" style={{ width: `${progress}%` }} />
		</div>
	);
}
