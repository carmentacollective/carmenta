/**
 * Provider logo icons as React components.
 * Using inline SVGs for better control over styling.
 */

import type { ModelProvider } from "@/lib/models";
import { cn } from "@/lib/utils";

interface IconProps {
    className?: string;
}

/**
 * Anthropic's "A" logo mark.
 */
export function AnthropicIcon({ className }: IconProps) {
    return (
        <svg
            viewBox="0 0 46 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("h-4 w-4", className)}
            aria-label="Anthropic"
        >
            <path d="M32.73 0H26.22L38.1 32H44.61L32.73 0Z" fill="currentColor" />
            <path
                d="M13.27 0L1.39 32H8.07L10.62 24.97H24.38L26.93 32H33.61L21.73 0H13.27ZM12.73 19.29L17.5 6.24L22.27 19.29H12.73Z"
                fill="currentColor"
            />
        </svg>
    );
}

/**
 * Google's four-color "G" logo mark.
 */
export function GoogleIcon({ className }: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("h-4 w-4", className)}
            aria-label="Google"
        >
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
            />
        </svg>
    );
}

/**
 * Grok logo mark - stylized "G" with black hole inspiration.
 * Official xAI/Grok branding.
 */
export function XAIIcon({ className }: IconProps) {
    return (
        <svg
            viewBox="0 0 1000 1000"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("h-4 w-4", className)}
            aria-label="xAI"
        >
            <path
                d="M386.2,616.2l332.5-245.7c16.3-12,39.6-7.3,47.4,11.4c40.9,98.7,22.6,217.3-58.7,298.7 C626,762,512.8,779.8,409.4,739.2l-113,52.4c162,110.9,358.8,83.5,481.8-39.7C875.8,654.2,906,521.1,877.7,401l0.3,0.3 C837,224.9,888,154.5,992.6,10.3c2.5-3.4,4.9-6.8,7.4-10.3L862.4,137.7v-0.4L386.2,616.2"
                fill="currentColor"
            />
            <path
                d="M317.6,676c-116.3-111.2-96.3-283.4,3-382.7 c73.4-73.5,193.6-103.5,298.6-59.4l112.7-52.1c-20.3-14.7-46.3-30.5-76.2-41.6c-135-55.6-296.6-27.9-406.3,81.8 c-105.6,105.7-138.7,268.2-81.7,406.8c42.6,103.6-27.2,176.9-97.5,250.9C45.1,906,20.1,932.3,0,960L317.6,676"
                fill="currentColor"
            />
        </svg>
    );
}

/**
 * OpenAI logo mark.
 * Used for ChatGPT models.
 */
export function OpenAIIcon({ className }: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("h-4 w-4", className)}
            aria-label="OpenAI"
        >
            <path
                d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"
                fill="currentColor"
            />
        </svg>
    );
}

/**
 * Perplexity logo mark.
 * Used for Perplexity models.
 */
export function PerplexityIcon({ className }: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("h-4 w-4", className)}
            aria-label="Perplexity"
        >
            <path
                d="M12 1L3 5.5V18.5L12 23L21 18.5V5.5L12 1Z"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
            />
            <path d="M12 1V23" stroke="currentColor" strokeWidth="1.5" />
            <path
                d="M3 5.5L12 10L21 5.5"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
            />
            <path d="M12 10V23" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    );
}

/**
 * Map of provider IDs to their icon components.
 */
const providerIcons: Record<ModelProvider, React.FC<IconProps>> = {
    anthropic: AnthropicIcon,
    google: GoogleIcon,
    "x-ai": XAIIcon,
    openai: OpenAIIcon,
    perplexity: PerplexityIcon,
};

/**
 * Get the appropriate provider icon component.
 */
export function getProviderIcon(provider: ModelProvider): React.FC<IconProps> {
    return providerIcons[provider] ?? AnthropicIcon;
}

/**
 * Provider Icon component that renders the correct icon based on provider.
 */
export function ProviderIcon({
    provider,
    className,
}: {
    provider: ModelProvider;
    className?: string;
}) {
    switch (provider) {
        case "anthropic":
            return <AnthropicIcon className={className} />;
        case "google":
            return <GoogleIcon className={className} />;
        case "x-ai":
            return <XAIIcon className={className} />;
        case "openai":
            return <OpenAIIcon className={className} />;
        case "perplexity":
            return <PerplexityIcon className={className} />;
        default:
            return <AnthropicIcon className={className} />;
    }
}
