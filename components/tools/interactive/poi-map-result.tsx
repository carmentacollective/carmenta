"use client";

import { POIMapWrapper } from "../primitives/poi-map-wrapper";
import type { POI, MapCenter } from "@/components/tool-ui/poi-map/schema";
import type { ToolStatus } from "@/lib/tools/tool-config";
import { ToolRenderer } from "../shared";

interface POIMapInput {
    pois?: POI[];
    center?: MapCenter;
    zoom?: number;
    title?: string;
}

interface POIMapOutput {
    pois?: POI[];
    center?: MapCenter;
    zoom?: number;
    title?: string;
}

interface POIMapResultProps {
    toolCallId: string;
    status: ToolStatus;
    toolName: string;
    input?: POIMapInput;
    output?: POIMapOutput;
    error?: string;
}

/**
 * POI Map result component for interactive location maps.
 *
 * Shows points of interest on a map with list, favorites, and filtering.
 */
export function POIMapResult({
    toolCallId,
    status,
    toolName,
    input,
    output,
    error,
}: POIMapResultProps) {
    // Use output if available (server-side updates), fall back to input
    // Ensure each POI has required fields with fallbacks
    const rawPois = output?.pois ?? input?.pois ?? [];
    const pois: POI[] = rawPois.map((poi, idx) => ({
        id: poi.id || `poi-${idx}`,
        name: poi.name,
        description: poi.description,
        category: (poi.category as POI["category"]) ?? "other",
        lat: poi.lat,
        lng: poi.lng,
        address: poi.address,
        rating: poi.rating,
        imageUrl: poi.imageUrl,
        tags: poi.tags,
    }));
    const center = output?.center ?? input?.center;
    const zoom = output?.zoom ?? input?.zoom;
    const title = output?.title ?? input?.title;

    const hasPOIs = status === "completed" && pois.length > 0;

    return (
        <ToolRenderer
            toolName={toolName}
            toolCallId={toolCallId}
            status={status}
            input={input as Record<string, unknown>}
            output={output as Record<string, unknown>}
            error={error}
        >
            {hasPOIs && (
                <POIMapWrapper
                    id={`poi-map-${toolCallId}`}
                    pois={pois}
                    initialCenter={center}
                    initialZoom={zoom}
                    title={title}
                />
            )}
        </ToolRenderer>
    );
}
