/**
 * Knowledge Base Tree Utilities
 *
 * Shared utilities for building and manipulating knowledge base tree structures.
 * Used by both the KB page and the import flow for consistent tree visualization.
 */

/**
 * Document representation for the tree view.
 * Compatible with both KBDocument from server actions and LiveKnowledgeBuilder's format.
 */
export interface KBDocumentData {
    id: string;
    path: string;
    name: string;
    content: string;
    description: string | null;
    sourceType?: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
}

/**
 * Tree node structure for display (after conversion from flat documents)
 */
export interface TreeNode {
    name: string;
    path: string;
    isFolder: boolean;
    children: TreeNode[];
    document?: KBDocumentData;
}

/**
 * Intermediate tree structure used during building (with Record keys)
 */
interface BuildingNode {
    name: string;
    path: string;
    isFolder: boolean;
    children: Record<string, BuildingNode>;
    document?: KBDocumentData;
}

/**
 * Build a tree structure from a flat list of documents.
 *
 * Converts dot-notation paths to a hierarchical tree:
 * - profile.identity → Profile folder → Identity document
 * - knowledge.people.sarah → Knowledge folder → People subfolder → Sarah document
 *
 * @param docs - Flat array of documents with dot-notation paths
 * @returns Hierarchical tree structure
 */
export function buildTree(docs: KBDocumentData[]): TreeNode[] {
    const root: Record<string, BuildingNode> = {};

    for (const doc of docs) {
        const parts = doc.path.split(".");
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            const pathSoFar = parts.slice(0, i + 1).join(".");

            if (!current[part]) {
                current[part] = {
                    name: part,
                    path: pathSoFar,
                    isFolder: !isLast,
                    children: {},
                    document: isLast ? doc : undefined,
                };
            }

            if (isLast) {
                current[part].document = doc;
                // Only mark as non-folder if there are no children
                const hasChildren = Object.keys(current[part].children).length > 0;
                current[part].isFolder = hasChildren;
            }

            current = current[part].children;
        }
    }

    // Convert to array and sort
    function toArray(nodes: Record<string, BuildingNode>): TreeNode[] {
        return Object.values(nodes)
            .map((node) => ({
                name: node.name,
                path: node.path,
                isFolder: node.isFolder,
                document: node.document,
                children: toArray(node.children),
            }))
            .sort((a, b) => {
                // Folders first, then alphabetically
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                return a.name.localeCompare(b.name);
            });
    }

    return toArray(root);
}

/**
 * Format a node name for display (capitalize, replace underscores)
 */
export function formatNodeName(name: string): string {
    return name
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * Find all parent paths for a given document path.
 * Used for auto-expanding parents when a new item arrives.
 *
 * @example getParentPaths("knowledge.people.sarah") returns ["knowledge", "knowledge.people"]
 */
export function getParentPaths(path: string): string[] {
    const parts = path.split(".");
    const parents: string[] = [];
    for (let i = 1; i < parts.length; i++) {
        parents.push(parts.slice(0, i).join("."));
    }
    return parents;
}

/**
 * Collect all document paths from a tree structure
 */
export function collectAllPaths(nodes: TreeNode[]): string[] {
    const paths: string[] = [];
    function traverse(node: TreeNode) {
        if (node.document) {
            paths.push(node.path);
        }
        node.children.forEach(traverse);
    }
    nodes.forEach(traverse);
    return paths;
}
