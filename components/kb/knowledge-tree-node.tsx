"use client";

/**
 * Knowledge Tree Node
 *
 * Recursive tree node component for displaying knowledge base documents.
 * Supports folder expand/collapse, selection, and "NEW" badge animations.
 */

import { motion, AnimatePresence } from "framer-motion";
import {
    CaretRightIcon,
    FolderIcon,
    FolderOpenIcon,
    FileTextIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { formatNodeName, type TreeNode } from "./tree-utils";

export interface KnowledgeTreeNodeProps {
    node: TreeNode;
    depth: number;
    expandedPaths: Set<string>;
    selectedPath: string | null;
    newPaths?: Set<string>;
    onToggle: (path: string) => void;
    onSelect: (path: string | null) => void;
}

export function KnowledgeTreeNode({
    node,
    depth,
    expandedPaths,
    selectedPath,
    newPaths = new Set(),
    onToggle,
    onSelect,
}: KnowledgeTreeNodeProps) {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedPath === node.path;
    const isNew = newPaths.has(node.path);
    const hasChildren = node.children.length > 0;

    // Format the display name nicely (capitalize, replace underscores)
    const displayName = formatNodeName(node.name);

    return (
        <div>
            <motion.div
                initial={
                    isNew
                        ? {
                              opacity: 0,
                              x: -10,
                              backgroundColor: "rgba(var(--primary), 0.2)",
                          }
                        : false
                }
                animate={{ opacity: 1, x: 0, backgroundColor: "transparent" }}
                transition={{ duration: 0.3 }}
                className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors",
                    isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted",
                    isNew && "ring-primary/50 ring-2"
                )}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={() => {
                    if (node.isFolder && hasChildren) {
                        onToggle(node.path);
                    } else if (node.document) {
                        onSelect(isSelected ? null : node.path);
                    }
                }}
            >
                {node.isFolder ? (
                    <>
                        <CaretRightIcon
                            className={cn(
                                "h-3 w-3 transition-transform",
                                isExpanded && "rotate-90"
                            )}
                        />
                        {isExpanded ? (
                            <FolderOpenIcon className="h-4 w-4 text-amber-500" />
                        ) : (
                            <FolderIcon className="h-4 w-4 text-amber-500" />
                        )}
                    </>
                ) : (
                    <>
                        <span className="w-3" />
                        <FileTextIcon className="text-muted-foreground h-4 w-4" />
                    </>
                )}
                <span className="truncate">{displayName}</span>
                {isNew && (
                    <span className="bg-primary/20 text-primary ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium">
                        NEW
                    </span>
                )}
            </motion.div>

            <AnimatePresence>
                {isExpanded && hasChildren && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {node.children.map((child) => (
                            <KnowledgeTreeNode
                                key={child.path}
                                node={child}
                                depth={depth + 1}
                                expandedPaths={expandedPaths}
                                selectedPath={selectedPath}
                                newPaths={newPaths}
                                onToggle={onToggle}
                                onSelect={onSelect}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
