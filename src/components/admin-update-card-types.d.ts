export interface UpdateStatusResponse {
    available: boolean;
    currentVersion: string;
    targetVersion?: string;
    releaseUrl: string;
    checkedAt: string;
    manualOnly: true;
    error?: string;
}

export interface MigrationStatusResponse {
	applied?: string[];
	error?: string;
	pending: string[];
	ready: boolean;
	unknown: string[];
}
