/**
 * Backend actions for CopilotKit.
 * These actions are executed server-side and can render UI components.
 *
 * Note: We define these inline in the CopilotRuntime constructor to avoid
 * type issues with CopilotKit's Action generics. The types expect Parameter[]
 * which is complex to work with externally.
 */

// Demo weather action - will be replaced with real integrations
export const getWeatherAction = {
    name: "getWeather",
    description:
        "Get the current weather for a location. Use this when the user asks about weather conditions.",
    parameters: [
        {
            name: "location",
            type: "string" as const,
            description: "The city or location to get weather for",
            required: true,
        },
    ],
    handler: async ({ location }: { location: string }) => {
        // Mock weather data for demo purposes
        // In production, this would call a real weather API
        const mockWeather = {
            location,
            temperature: Math.floor(Math.random() * 30) + 10,
            condition: ["sunny", "cloudy", "rainy", "clear"][
                Math.floor(Math.random() * 4)
            ],
            humidity: Math.floor(Math.random() * 60) + 40,
            windSpeed: Math.floor(Math.random() * 30) + 5,
            unit: "celsius" as const,
        };

        return JSON.stringify(mockWeather);
    },
};

// Demo comparison action
export const compareOptionsAction = {
    name: "compareOptions",
    description:
        "Compare multiple options in a table format. Use this when the user asks to compare items.",
    parameters: [
        {
            name: "title",
            type: "string" as const,
            description: "Title for the comparison",
            required: true,
        },
        {
            name: "items",
            type: "string" as const,
            description:
                "JSON array of items to compare, each with properties to show in columns",
            required: true,
        },
    ],
    handler: async ({ title, items }: { title: string; items: string }) => {
        return JSON.stringify({
            title,
            data: JSON.parse(items),
        });
    },
};

// All backend actions
export const backendActions = [getWeatherAction, compareOptionsAction];
