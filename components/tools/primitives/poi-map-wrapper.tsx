"use client";

/**
 * POIMapWrapper - Stateful wrapper for POIMap in chat context
 *
 * The POIMap component requires external state management for display mode,
 * widget state (selection, favorites, viewport), and theme. This wrapper
 * provides that state management for use in the chat tool renderer.
 */

import { useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { POIMap } from "@/components/tool-ui/poi-map";
import type {
    POI,
    POIMapViewState,
    MapCenter,
    POICategory,
} from "@/components/tool-ui/poi-map/schema";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@/components/tool-ui/poi-map/schema";

type DisplayMode = "inline" | "pip" | "fullscreen" | "carousel";

interface View {
    mode: "modal" | "inline";
    params: Record<string, unknown> | null;
}

export interface POIMapWrapperProps {
    id: string;
    pois: POI[];
    initialCenter?: MapCenter;
    initialZoom?: number;
    title?: string;
    className?: string;
}

export function POIMapWrapper({
    id,
    pois,
    initialCenter,
    initialZoom,
    title,
    className,
}: POIMapWrapperProps) {
    const { resolvedTheme } = useTheme();
    const theme = resolvedTheme === "dark" ? "dark" : "light";

    // Display mode state - start inline, can expand to fullscreen
    const [displayMode, setDisplayMode] = useState<DisplayMode>("inline");

    // Modal view state for POI details
    const [view, setView] = useState<View | null>(null);

    // Widget state for map viewport, selection, favorites
    const [widgetState, setWidgetState] = useState<POIMapViewState>({
        selectedPoiId: null,
        favoriteIds: [],
        mapCenter: initialCenter ?? DEFAULT_CENTER,
        mapZoom: initialZoom ?? DEFAULT_ZOOM,
        categoryFilter: null,
    });

    const handleWidgetStateChange = useCallback((partial: Partial<POIMapViewState>) => {
        setWidgetState((prev) => ({ ...prev, ...partial }));
    }, []);

    const handleRequestDisplayMode = useCallback((mode: DisplayMode) => {
        setDisplayMode(mode);
    }, []);

    const handleViewDetails = useCallback((poiId: string) => {
        setView({ mode: "modal", params: { poiId } });
    }, []);

    const handleDismissModal = useCallback(() => {
        setView(null);
    }, []);

    const handleToggleFavorite = useCallback((poiId: string, isFavorite: boolean) => {
        setWidgetState((prev) => {
            const newFavorites = isFavorite
                ? [...prev.favoriteIds, poiId]
                : prev.favoriteIds.filter((id) => id !== poiId);
            return { ...prev, favoriteIds: newFavorites };
        });
    }, []);

    const handleFilterCategory = useCallback((category: POICategory | null) => {
        setWidgetState((prev) => ({ ...prev, categoryFilter: category }));
    }, []);

    // Fullscreen mode needs a fixed container
    if (displayMode === "fullscreen") {
        return (
            <div className="z-modal bg-background fixed inset-0">
                <POIMap
                    id={id}
                    pois={pois}
                    initialCenter={initialCenter}
                    initialZoom={initialZoom}
                    title={title}
                    className="h-full w-full"
                    displayMode={displayMode}
                    widgetState={widgetState}
                    theme={theme}
                    view={view}
                    onWidgetStateChange={handleWidgetStateChange}
                    onRequestDisplayMode={handleRequestDisplayMode}
                    onToggleFavorite={handleToggleFavorite}
                    onFilterCategory={handleFilterCategory}
                    onViewDetails={handleViewDetails}
                    onDismissModal={handleDismissModal}
                />
            </div>
        );
    }

    return (
        <div className={className} style={{ height: "320px" }}>
            <POIMap
                id={id}
                pois={pois}
                initialCenter={initialCenter}
                initialZoom={initialZoom}
                title={title}
                className="h-full w-full"
                displayMode={displayMode}
                widgetState={widgetState}
                theme={theme}
                view={view}
                onWidgetStateChange={handleWidgetStateChange}
                onRequestDisplayMode={handleRequestDisplayMode}
                onToggleFavorite={handleToggleFavorite}
                onFilterCategory={handleFilterCategory}
                onViewDetails={handleViewDetails}
                onDismissModal={handleDismissModal}
            />
        </div>
    );
}
