"use client";

import { cn } from "@/lib/utils";

interface WeatherData {
    location: string;
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    unit?: "celsius" | "fahrenheit";
}

interface WeatherCardProps {
    data: WeatherData;
    className?: string;
}

const conditionIcons: Record<string, string> = {
    sunny: "☀️",
    cloudy: "☁️",
    rainy: "🌧️",
    snowy: "❄️",
    stormy: "⛈️",
    windy: "💨",
    foggy: "🌫️",
    clear: "🌙",
};

export function WeatherCard({ data, className }: WeatherCardProps) {
    const icon = conditionIcons[data.condition.toLowerCase()] || "🌡️";
    const tempUnit = data.unit === "fahrenheit" ? "°F" : "°C";

    return (
        <div className={cn("blueprint-box p-4", className)}>
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-bold text-foreground">
                        {data.location}
                    </h3>
                    <p className="text-sm capitalize text-muted-foreground">
                        {data.condition}
                    </p>
                </div>
                <span className="text-4xl">{icon}</span>
            </div>

            <div className="mt-4">
                <div className="text-4xl font-bold text-primary">
                    {data.temperature}
                    {tempUnit}
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div>
                    <p className="text-xs text-muted-foreground">Humidity</p>
                    <p className="text-sm font-medium text-foreground">
                        {data.humidity}%
                    </p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Wind</p>
                    <p className="text-sm font-medium text-foreground">
                        {data.windSpeed} km/h
                    </p>
                </div>
            </div>
        </div>
    );
}
