import Image from "next/image";

interface LoadingSpinnerProps {
    size?: number;
    className?: string;
}

export function LoadingSpinner({ size = 48, className = "" }: LoadingSpinnerProps) {
    return (
        <div className={`flex items-center justify-center ${className}`}>
            <div className="animate-spin-slow">
                <Image
                    src="/logos/icon-transparent.png"
                    alt="Loading"
                    width={size}
                    height={size}
                    className="opacity-80"
                />
            </div>
        </div>
    );
}
