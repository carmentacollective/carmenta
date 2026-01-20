import { useSyncExternalStore } from "react";

/**
 * Hook to detect if we're running on the client (after hydration).
 *
 * Uses useSyncExternalStore to safely handle SSR hydration:
 * - Returns false during SSR (getServerSnapshot)
 * - Returns true on the client (getSnapshot)
 *
 * Use this to defer rendering of components that cause hydration mismatches,
 * such as Radix UI primitives that generate unique IDs on server vs client.
 *
 * @example
 * ```tsx
 * const isClient = useIsClient();
 *
 * if (!isClient) {
 *   return <PlaceholderComponent />;
 * }
 *
 * return <RadixComponentThatCausesHydrationMismatch />;
 * ```
 */
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function useIsClient(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
