"use client";

/**
 * Knowledge Tree
 *
 * Tree view container for knowledge base documents.
 * Manages expand/collapse state and delegates rendering to KnowledgeTreeNode.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { KnowledgeTreeNode } from "./knowledge-tree-node";
import {
    buildTree,
    getParentPaths,
    collectAllPaths,
    type KBDocumentData,
} from "./tree-utils";

export interface KnowledgeTreeProps {
    documents: KBDocumentData[];
    selectedPath: string | null;
    onSelect: (path: string | null) => void;
    /** Paths to highlight as new (for import animation) */
    newPaths?: Set<string>;
    /** Initial expanded paths. If not provided, all folders are expanded. */
    initialExpandedPaths?: Set<string>;
    /** Auto-expand parents of new items */
    autoExpandNew?: boolean;
    className?: string;
}

export function KnowledgeTree({
    documents,
    selectedPath,
    onSelect,
    newPaths = new Set(),
    initialExpandedPaths,
    autoExpandNew = true,
    className,
}: KnowledgeTreeProps) {
    // Build tree from documents
    const tree = useMemo(() => buildTree(documents), [documents]);

    // Track which paths we've seen for auto-expand logic
    const seenPaths = useRef<Set<string>>(new Set());

    // Initialize expanded paths - default to expanding all folders
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
        if (initialExpandedPaths) {
            return initialExpandedPaths;
        }
        // By default, expand all root-level folders
        const initial = new Set<string>();
        tree.forEach((node) => {
            if (node.isFolder) {
                initial.add(node.path);
            }
        });
        return initial;
    });

    // Auto-expand parents when new items arrive
    useEffect(() => {
        if (!autoExpandNew || newPaths.size === 0) return;

        // Find truly new paths (not seen before)
        const trulyNew: string[] = [];
        newPaths.forEach((path) => {
            if (!seenPaths.current.has(path)) {
                trulyNew.push(path);
                seenPaths.current.add(path);
            }
        });

        if (trulyNew.length === 0) return;

        // Auto-expand parents of new items
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            trulyNew.forEach((path) => {
                getParentPaths(path).forEach((parent) => next.add(parent));
            });
            return next;
        });
    }, [newPaths, autoExpandNew]);

    // Track all seen paths for future new detection
    useEffect(() => {
        collectAllPaths(tree).forEach((path) => seenPaths.current.add(path));
    }, [tree]);

    const toggleExpanded = useCallback((path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    if (tree.length === 0) {
        return (
            <p className="text-muted-foreground py-8 text-center text-sm">
                Your knowledge base is empty.
                <br />
                Documents will appear here as we learn about you.
            </p>
        );
    }

    return (
        <div className={cn("space-y-0.5", className)}>
            {tree.map((node) => (
                <KnowledgeTreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                    expandedPaths={expandedPaths}
                    selectedPath={selectedPath}
                    newPaths={newPaths}
                    onToggle={toggleExpanded}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
}
