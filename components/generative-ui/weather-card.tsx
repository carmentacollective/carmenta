"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { Cloud, Sun, CloudRain, Droplets, Thermometer, Wind } from "lucide-react";

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
 * Tool UI for displaying weather information as a card.
 *
 * Renders when the AI calls the getWeather tool, showing:
 * - Location name
 * - Current condition with icon
 * - Temperature
 * - Humidity
 * - Wind speed
 */
export const WeatherToolUI = makeAssistantToolUI<WeatherArgs, WeatherResult>({
    toolName: "getWeather",
    render: ({ args, result, status }) => {
        // Loading state
        if (status.type === "running") {
            return (
                <div className="glass-card max-w-xs animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded bg-muted" />
                        <div className="space-y-2">
                            <div className="h-4 w-24 rounded bg-muted" />
                            <div className="h-3 w-16 rounded bg-muted" />
                        </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Getting weather for {args.location}...
                    </p>
                </div>
            );
        }

        // Error/incomplete state
        if (status.type === "incomplete" || !result) {
            return (
                <div className="glass-card max-w-xs border-destructive/50 bg-destructive/10">
                    <p className="text-sm text-destructive">
                        Couldn&apos;t get weather for {args.location}
                    </p>
                </div>
            );
        }

        // Success state
        return (
            <div className="glass-card max-w-xs">
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
                        <span className="text-lg font-bold">
                            {result.temperature}°C
                        </span>
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
    },
});
