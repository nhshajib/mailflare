"use client";

import { useMailSearch } from "@/components/mail-search/mail-search-context";
import { useSelectedMailbox } from "@/components/mailbox-provider";
import { useHydrated } from "@/hooks/use-hydrated";
import { useResettableState } from "@/hooks/use-resettable-state";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { useSidebar } from "@/components/sidebar-state";
import { useAssistantOpen } from "@/components/agent/assistant-open-state";
import { readColumnWidth, readInitialColumnWidth, saveColumnWidth } from "@/components/column-width-preferences";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { BulkMessageSelectionPane } from "./bulk-message-selection-pane";
import { MessageFolderPage } from "./message-folder-page";
import { MessageDetailNavigationProvider } from "./message-detail-navigation";
import { MessageListVisibilityContext } from "./message-list-visibility";
import { readInitialMessageListVisible, saveMessageListVisible } from "./message-list-visibility-utils";
import { useTwoColumnReading } from "./use-two-column-reading";
import type { MessageSplitLayoutProps, SelectedMessage } from "./types";

export function MessageSplitLayout({
	children,
	config,
}: MessageSplitLayoutProps) {
	const pathname = usePathname();
	const hydrated = useHydrated();
	const { userId, setForcedMinimal } = useSidebar();
	const { query } = useMailSearch();
  const { selectedMailbox } = useSelectedMailbox();
  const [selectedMessages, setSelectedMessages] = useResettableState<SelectedMessage[]>(JSON.stringify([query, selectedMailbox?.id, config.folder, config.folderId]), []);
	const [listWidth, setListWidth] = useResettableState(`${hydrated}:${userId}`, hydrated ? (userId ? readColumnWidth(userId, "message-list", readInitialColumnWidth("message-list", 360, 250, 1200), 250, 1200) : readInitialColumnWidth("message-list", 360, 250, 1200)) : 360);
	const widthReady = hydrated;
	const [containerWidth, setContainerWidth] = useState(0);
	const [manualListVisible, setManualListVisible] = useResettableState(hydrated, hydrated ? readInitialMessageListVisible() : true);
	const [twoColumnReading] = useTwoColumnReading();
	const containerRef = useRef<HTMLDivElement>(null);
	const startWidth = useRef(listWidth);
	const resizedWidth = useRef(listWidth);
	const { t } = useLanguage();
	const assistantOpen = useAssistantOpen();
	const listVisible = twoColumnReading && !assistantOpen && manualListVisible;
	const detailPrefix = `${config.hrefPrefix}/`;
	const selectedMessageId = pathname.startsWith(detailPrefix)
		? pathname.slice(detailPrefix.length).split("/")[0]
		: undefined;
	const renderedListWidth = Math.max(250, Math.min(listWidth, (containerWidth || 1000) - 280));

	useLayoutEffect(() => {
		if (!selectedMessageId) {
			setForcedMinimal(false);
			return;
		}
		const container = containerRef.current;
		if (!container) return;
		const observer = new ResizeObserver(() => setContainerWidth(container.clientWidth));
		observer.observe(container);
		return () => observer.disconnect();
	}, [selectedMessageId, setForcedMinimal]);

	useEffect(() => () => setForcedMinimal(false), [setForcedMinimal]);

	if (!selectedMessageId) return children;

	return (
		<div ref={containerRef} className="h-full min-h-0 overflow-hidden lg:grid lg:transition-[grid-template-columns] lg:ease-in-out motion-reduce:transition-none" style={{ gridTemplateColumns: twoColumnReading ? `${listVisible ? renderedListWidth : 0}px minmax(0,1fr)` : "minmax(0,1fr)", transitionDuration: widthReady ? "300ms" : "0ms" }}>
			{twoColumnReading && (
			<aside className={`relative hidden min-h-0 min-w-0 overflow-hidden bg-white lg:block ${listVisible ? "border-r border-neutral-200" : "pointer-events-none"}`} aria-hidden={!listVisible} inert={!listVisible}>
				<div className={`h-full overflow-hidden transition-transform duration-300 ease-in-out motion-reduce:transition-none ${listVisible ? "translate-x-0" : "-translate-x-full"}`} style={{ width: renderedListWidth }}>
				<MessageFolderPage
					config={config}
					compact
					selectedMessageId={selectedMessageId}
					selection={{ selectedMessages, setSelectedMessages }}
				/>
				</div>
				<ResizeHandle
					label={t("list.resize")}
					onResizeStart={() => { startWidth.current = listWidth; resizedWidth.current = listWidth; }}
					onResize={(delta) => {
						const requestedWidth = startWidth.current + delta;
						setForcedMinimal(requestedWidth < 250);
						resizedWidth.current = Math.max(250, Math.min(requestedWidth, Math.max(250, (containerRef.current?.clientWidth ?? 1000) - 280)));
						setListWidth(resizedWidth.current);
					}}
					onResizeEnd={() => saveColumnWidth(userId, "message-list", resizedWidth.current)}
				/>
			</aside>
			)}
			<MessageListVisibilityContext.Provider value={{ visible: listVisible, toggle: () => { const visible = !manualListVisible; setManualListVisible(visible); saveMessageListVisible(visible); }, singleColumn: !twoColumnReading, backHref: config.hrefPrefix, backLabel: config.titleKey ? t(config.titleKey) : config.title }}>
			<MessageDetailNavigationProvider config={config}>
			<section className="min-h-0 min-w-0 overflow-hidden bg-white flex flex-col h-full">
				{twoColumnReading && selectedMessages.length > 0 ? (
					<BulkMessageSelectionPane
						folder={config.folder}
						selectedMessages={selectedMessages}
						onClearSelection={() => setSelectedMessages([])}
					/>
				) : (
					children
				)}
			</section>
			</MessageDetailNavigationProvider>
			</MessageListVisibilityContext.Provider>
		</div>
	);
}
