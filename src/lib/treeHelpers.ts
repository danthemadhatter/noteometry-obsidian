import type { TreeNode } from "./treeTypes";

export function findNode(tree: TreeNode[], path: string): TreeNode | null {
	if (!path) return null;
	for (const node of tree) {
		if (node.path === path) return node;
		if (node.children) {
			const found = findNode(node.children, path);
			if (found) return found;
		}
	}
	return null;
}

export function getParentPath(path: string): string {
	const idx = path.lastIndexOf("/");
	return idx === -1 ? "" : path.slice(0, idx);
}

export function getBasename(path: string): string {
	const idx = path.lastIndexOf("/");
	return idx === -1 ? path : path.slice(idx + 1);
}

export function walkLeaves(tree: TreeNode[]): TreeNode[] {
	const out: TreeNode[] = [];
	const recurse = (nodes: TreeNode[]): void => {
		for (const node of nodes) {
			if (node.kind === "page") {
				out.push(node);
			} else if (node.children) {
				recurse(node.children);
			}
		}
	};
	recurse(tree);
	return out;
}

export function firstLeafPath(tree: TreeNode[]): string | null {
	const leaves = walkLeaves(tree);
	return leaves[0]?.path ?? null;
}

export function nextSiblingPath(tree: TreeNode[], path: string): string | null {
	if (!path) return null;
	const parent = getParentPath(path);
	const siblings = parent === ""
		? tree
		: findNode(tree, parent)?.children ?? [];
	const idx = siblings.findIndex((n) => n.path === path);
	if (idx === -1) return null;
	return siblings[idx + 1]?.path ?? siblings[idx - 1]?.path ?? null;
}

export function ancestorPaths(path: string): string[] {
	if (!path) return [];
	const out: string[] = [];
	const parts = path.split("/");
	for (let i = 1; i < parts.length; i++) {
		out.push(parts.slice(0, i).join("/"));
	}
	return out;
}
