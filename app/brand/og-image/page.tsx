import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
    title: "OG Image | Carmenta",
    description: "Social media preview image for Carmenta",
    robots: {
        index: false,
        follow: false,
    },
};

export default function OGImagePage() {
    return (
        <div className="flex h-[630px] w-[1200px] items-center justify-center">
            <div className="absolute inset-0 bg-background">
                <div className="flex h-full">
                    {/* Left side - Brand */}
                    <div className="flex w-1/2 flex-col items-center justify-center space-y-6 border-r border-foreground/10 px-16">
                        <Image
                            src="/logos/icon-transparent.png"
                            alt="Carmenta"
                            width={160}
                            height={160}
                            className="h-[160px] w-[160px]"
                        />
                        <h1 className="text-6xl font-light tracking-tight text-foreground">
                            Carmenta
                        </h1>
                    </div>
                    {/* Right side - Message */}
                    <div className="flex w-1/2 flex-col justify-center space-y-8 px-16">
                        <div className="space-y-4">
                            <p className="text-4xl font-light leading-tight text-foreground">
                                Create at the speed
                                <br />
                                of thought.
                            </p>
                        </div>
                        <p className="text-xl leading-normal text-muted-foreground">
                            One interface, every model, memory that persists.
                            Partnership, not tool-use.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
