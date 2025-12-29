/**
 * Project Discovery for Code Mode
 *
 * Scans the configured source directory for git repositories that can be worked on.
 * In dev mode, this looks at local directories. Future: GitHub integration.
 */

import { promises as fs } from "fs";
import path from "path";

import { logger } from "@/lib/logger";

/**
 * Project metadata for code mode
 */
export interface Project {
    id: string;
    name: string;
    path: string;
    description?: string;
    lastModified?: Date;
    hasClaudeMd: boolean;
    gitBranch?: string;
}

/**
 * Default source directories to scan for projects
 */
const DEFAULT_SOURCE_DIRS = [
    process.env.CODE_SOURCE_DIR,
    process.env.HOME ? path.join(process.env.HOME, "src") : null,
].filter(Boolean) as string[];

/**
 * Maximum depth to recurse when looking for git repos
 */
const MAX_DEPTH = 2;

/**
 * Directories to skip when scanning
 */
const SKIP_DIRS = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    ".cache",
    "coverage",
    "__pycache__",
    ".venv",
    "venv",
]);

/**
 * Check if a directory is a git repository
 */
async function isGitRepo(dirPath: string): Promise<boolean> {
    try {
        const gitPath = path.join(dirPath, ".git");
        const stat = await fs.stat(gitPath);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

/**
 * Check if a directory has a CLAUDE.md file
 */
async function hasClaudeMd(dirPath: string): Promise<boolean> {
    try {
        await fs.access(path.join(dirPath, "CLAUDE.md"));
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the current git branch for a repository
 */
async function getGitBranch(dirPath: string): Promise<string | undefined> {
    try {
        const headPath = path.join(dirPath, ".git", "HEAD");
        const content = await fs.readFile(headPath, "utf-8");
        const match = content.match(/ref: refs\/heads\/(.+)/);
        return match ? match[1].trim() : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Get the last modified time for a directory (based on .git/index or HEAD)
 */
async function getLastModified(dirPath: string): Promise<Date | undefined> {
    try {
        // Try .git/index first (most recent git operation)
        const indexPath = path.join(dirPath, ".git", "index");
        const stat = await fs.stat(indexPath);
        return stat.mtime;
    } catch {
        try {
            // Fall back to .git/HEAD
            const headPath = path.join(dirPath, ".git", "HEAD");
            const stat = await fs.stat(headPath);
            return stat.mtime;
        } catch {
            return undefined;
        }
    }
}

/**
 * Extract project description from package.json or CLAUDE.md
 */
async function getProjectDescription(dirPath: string): Promise<string | undefined> {
    // Try package.json first
    try {
        const packagePath = path.join(dirPath, "package.json");
        const content = await fs.readFile(packagePath, "utf-8");
        const pkg = JSON.parse(content);
        if (pkg.description) {
            return pkg.description;
        }
    } catch {
        // No package.json or invalid JSON
    }

    // Try CLAUDE.md - extract first non-empty line that's not a heading
    try {
        const claudePath = path.join(dirPath, "CLAUDE.md");
        const content = await fs.readFile(claudePath, "utf-8");
        const lines = content.split("\n");
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---")) {
                return trimmed.substring(0, 200);
            }
        }
    } catch {
        // No CLAUDE.md
    }

    return undefined;
}

/**
 * Recursively scan a directory for git repositories
 */
async function scanDirectory(
    dirPath: string,
    depth: number = 0,
    projects: Project[] = []
): Promise<Project[]> {
    if (depth > MAX_DEPTH) {
        return projects;
    }

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (
                !entry.isDirectory() ||
                SKIP_DIRS.has(entry.name) ||
                entry.name.startsWith(".")
            ) {
                continue;
            }

            const fullPath = path.join(dirPath, entry.name);

            // Check if this is a git repo
            if (await isGitRepo(fullPath)) {
                const [claudeMd, branch, lastModified, description] = await Promise.all(
                    [
                        hasClaudeMd(fullPath),
                        getGitBranch(fullPath),
                        getLastModified(fullPath),
                        getProjectDescription(fullPath),
                    ]
                );

                projects.push({
                    id: fullPath, // Use path as ID for now
                    name: entry.name,
                    path: fullPath,
                    description,
                    lastModified,
                    hasClaudeMd: claudeMd,
                    gitBranch: branch,
                });
            } else {
                // Not a git repo, recurse
                await scanDirectory(fullPath, depth + 1, projects);
            }
        }
    } catch (error) {
        logger.warn({ error, path: dirPath }, "Failed to scan directory");
    }

    return projects;
}

/**
 * Discover all available projects
 */
export async function discoverProjects(): Promise<Project[]> {
    const allProjects: Project[] = [];

    for (const sourceDir of DEFAULT_SOURCE_DIRS) {
        try {
            const stat = await fs.stat(sourceDir);
            if (stat.isDirectory()) {
                logger.info({ sourceDir }, "Scanning for projects");
                const projects = await scanDirectory(sourceDir);
                allProjects.push(...projects);
            }
        } catch (error) {
            logger.warn({ error, sourceDir }, "Source directory not accessible");
        }
    }

    // Sort by last modified (most recent first), then by name
    allProjects.sort((a, b) => {
        if (a.lastModified && b.lastModified) {
            return b.lastModified.getTime() - a.lastModified.getTime();
        }
        if (a.lastModified) return -1;
        if (b.lastModified) return 1;
        return a.name.localeCompare(b.name);
    });

    logger.info({ count: allProjects.length }, "Projects discovered");
    return allProjects;
}

/**
 * Validate that a project path exists and is a git repository
 * within allowed source directories (prevents path traversal)
 */
export async function validateProject(projectPath: string): Promise<boolean> {
    try {
        // Normalize the path to prevent traversal tricks
        const normalizedPath = path.resolve(projectPath);

        // Ensure path is within allowed source directories
        const isWithinSourceDir = DEFAULT_SOURCE_DIRS.some((sourceDir) =>
            normalizedPath.startsWith(path.resolve(sourceDir))
        );

        if (!isWithinSourceDir) {
            logger.warn(
                { projectPath, normalizedPath },
                "Project path outside allowed source directories"
            );
            return false;
        }

        const stat = await fs.stat(normalizedPath);
        if (!stat.isDirectory()) {
            return false;
        }

        return await isGitRepo(normalizedPath);
    } catch {
        return false;
    }
}

/**
 * Get details for a specific project
 */
export async function getProject(projectPath: string): Promise<Project | null> {
    if (!(await validateProject(projectPath))) {
        return null;
    }

    const name = path.basename(projectPath);
    const [claudeMd, branch, lastModified, description] = await Promise.all([
        hasClaudeMd(projectPath),
        getGitBranch(projectPath),
        getLastModified(projectPath),
        getProjectDescription(projectPath),
    ]);

    return {
        id: projectPath,
        name,
        path: projectPath,
        description,
        lastModified,
        hasClaudeMd: claudeMd,
        gitBranch: branch,
    };
}
