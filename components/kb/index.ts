/**
 * Knowledge Base Components
 *
 * Unified components for displaying and editing the knowledge base.
 * Used by both the KB page and the import flow.
 */

export { KnowledgeExplorer } from "./knowledge-explorer";
export type { KnowledgeExplorerProps } from "./knowledge-explorer";

export { KnowledgeTree } from "./knowledge-tree";
export type { KnowledgeTreeProps } from "./knowledge-tree";

export { KnowledgeTreeNode } from "./knowledge-tree-node";
export type { KnowledgeTreeNodeProps } from "./knowledge-tree-node";

export { KnowledgeDetail } from "./knowledge-detail";
export type { KnowledgeDetailProps } from "./knowledge-detail";

export {
    buildTree,
    formatNodeName,
    getParentPaths,
    collectAllPaths,
} from "./tree-utils";
export type { TreeNode, KBDocumentData } from "./tree-utils";
