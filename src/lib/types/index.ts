export interface ImageEntry {
	path: string;
	name: string;
	extension: string;
	size_bytes: number;
	folder: string;
	modified: number;
	width: number;
	height: number;
}

export interface FolderNode {
	path: string;
	name: string;
	children: FolderNode[];
	image_count: number;
}

export interface SmartFolder {
	id: string;
	name: string;
	rules: SmartFolderRule[];
}

export interface SmartFolderRule {
	field: 'name' | 'extension' | 'size' | 'folder';
	operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than';
	value: string;
}

export type ViewMode = 'grid' | 'list';
export type SortBy = 'path' | 'name' | 'size' | 'modified' | 'extension';
export type SortDirection = 'asc' | 'desc';
