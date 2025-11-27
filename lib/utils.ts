import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for merging Tailwind CSS classes with proper precedence
 *
 * Combines clsx for conditional classes with tailwind-merge for
 * intelligent class merging (e.g., p-2 + p-4 = p-4, not "p-2 p-4")
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
