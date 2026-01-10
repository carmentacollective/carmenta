/**
 * Image Artist Types
 */

/**
 * Task types for model routing
 */
export type ImageTaskType =
    | "diagram"
    | "text"
    | "logo"
    | "photo"
    | "illustration"
    | "default";

/**
 * Model configuration for generation
 */
export interface ImageModelConfig {
    id: string;
    name: string;
    api: "generateImage" | "generateText";
    provider: "gateway";
}

/**
 * Result of image generation
 */
export interface GeneratedImage {
    base64: string;
    mimeType: string;
}

/**
 * Complete generation result returned by the agent
 */
export interface ImageArtistResult {
    /** Whether images were generated */
    generated: boolean;
    /** Generated images */
    images: GeneratedImage[];
    /** The expanded prompt used */
    expandedPrompt: string;
    /** Original user prompt */
    originalPrompt: string;
    /** Model used for generation */
    model: string;
    /** Task type detected */
    taskType: ImageTaskType;
    /** Aspect ratio used */
    aspectRatio: string;
    /** Generation duration in ms */
    durationMs: number;
    /** Any suggestions for iteration */
    suggestions?: string;
}

/**
 * Input to the image artist agent
 */
export interface ImageArtistInput {
    /** User's image request */
    prompt: string;
    /** Optional style hints from conversation */
    style?: string;
    /** Optional aspect ratio */
    aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
    /** Optional reference image base64 */
    referenceImage?: string;
    /** User ID for logging */
    userId: string;
}
