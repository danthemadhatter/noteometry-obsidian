export interface TreeNode {
	name: string;
	path: string;
	kind: "folder" | "page";
	depth: number;
	children?: TreeNode[];
}
