"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { Sun, CloudRain, Cloud, Droplets, Thermometer, Wind } from "lucide-react";

import { ToolWrapper } from "./tool-wrapper";
import type { ToolStatus } from "@/lib/tools/tool-config";

interface WeatherArgs {
    location: string;
}

interface WeatherResult {
    location: string;
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
}

/**
 * Map assistant-ui status to our ToolStatus
 */
function mapStatus(
    statusType: "running" | "incomplete" | "requires-action" | "complete",
    hasResult: boolean
): ToolStatus {
    if (statusType === "running") return "running";
    if (statusType === "incomplete") return "error";
    if (hasResult) return "completed";
    return "pending";
}

const WeatherIcon = ({ condition }: { condition: string }) => {
    const iconClass = "h-12 w-12 text-primary";

    switch (condition.toLowerCase()) {
        case "sunny":
            return <Sun className={iconClass} />;
        case "rainy":
            return <CloudRain className={iconClass} />;
        case "cloudy":
        case "partly cloudy":
        default:
            return <Cloud className={iconClass} />;
    }
};

/**
 * Weather card content - the actual weather display
 */
function WeatherCardContent({ result }: { result: WeatherResult }) {
    return (
        <div className="max-w-xs">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-foreground">{result.location}</h3>
                    <p className="text-sm capitalize text-muted-foreground">
                        {result.condition}
                    </p>
                </div>
                <WeatherIcon condition={result.condition} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center gap-1">
                    <Thermometer className="h-5 w-5 text-muted-foreground" />
                    <span className="text-lg font-bold">{result.temperature}°C</span>
                    <span className="text-xs text-muted-foreground">Temp</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <Droplets className="h-5 w-5 text-muted-foreground" />
                    <span className="text-lg font-bold">{result.humidity}%</span>
                    <span className="text-xs text-muted-foreground">Humidity</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <Wind className="h-5 w-5 text-muted-foreground" />
                    <span className="text-lg font-bold">{result.windSpeed}</span>
                    <span className="text-xs text-muted-foreground">km/h</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Loading skeleton for weather card
 */
function WeatherCardSkeleton({ location }: { location: string }) {
    return (
        <div className="max-w-xs animate-pulse">
            <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded bg-muted" />
                <div className="space-y-2">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="h-3 w-16 rounded bg-muted" />
                </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
                Checking the weather in {location}...
            </p>
        </div>
    );
}

/**
 * Error state for weather card
 */
function WeatherCardError({ location }: { location: string }) {
    return (
        <div className="max-w-xs">
            <p className="text-sm text-muted-foreground">
                Weather for {location} didn&apos;t come through. Want to try again?
            </p>
        </div>
    );
}

/**
 * Tool UI for displaying weather information.
 *
 * Uses ToolWrapper for:
 * - Status indicators with delight
 * - Collapsible container
 * - Admin debug panel
 * - First-use celebration
 */
export const WeatherToolUI = makeAssistantToolUI<WeatherArgs, WeatherResult>({
    toolName: "getWeather",
    render: ({ args, result, status, toolCallId }) => {
        const toolStatus = mapStatus(status.type, !!result);

        return (
            <ToolWrapper
                toolName="getWeather"
                toolCallId={toolCallId}
                status={toolStatus}
                input={args}
                output={result}
                error={
                    status.type === "incomplete" ? "Weather request failed" : undefined
                }
            >
                {status.type === "running" && (
                    <WeatherCardSkeleton location={args.location} />
                )}
                {status.type === "incomplete" && (
                    <WeatherCardError location={args.location} />
                )}
                {result && <WeatherCardContent result={result} />}
            </ToolWrapper>
        );
    },
});
