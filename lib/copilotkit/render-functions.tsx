"use client";

import { WeatherCard } from "@/components/generative-ui/weather-card";
import { DataTable } from "@/components/generative-ui/data-table";

/**
 * Render functions for CopilotKit tool results.
 * These map backend action results to frontend UI components.
 */

interface WeatherData {
    location: string;
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    unit?: "celsius" | "fahrenheit";
}

interface ComparisonData {
    title: string;
    data: Record<string, string | number>[];
}

export function renderWeather(result: string) {
    try {
        const data = JSON.parse(result) as WeatherData;
        return <WeatherCard data={data} />;
    } catch {
        return (
            <div className="text-sm text-muted-foreground">
                Unable to display weather data
            </div>
        );
    }
}

export function renderComparison(result: string) {
    try {
        const { title, data } = JSON.parse(result) as ComparisonData;

        // Auto-generate columns from data keys
        const columns =
            data.length > 0
                ? Object.keys(data[0]).map((key) => ({
                      key,
                      header:
                          key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
                  }))
                : [];

        return <DataTable title={title} columns={columns} data={data} />;
    } catch {
        return (
            <div className="text-sm text-muted-foreground">
                Unable to display comparison data
            </div>
        );
    }
}

/**
 * Registry mapping action names to render functions.
 * Used by the Connect component to render tool results.
 */
export const renderFunctions: Record<string, (result: string) => React.ReactNode> = {
    getWeather: renderWeather,
    compareOptions: renderComparison,
};
