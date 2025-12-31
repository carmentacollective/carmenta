"use client";

import Image from "next/image";

export function PreviewVariation1() {
    return (
        <div className="absolute inset-0 bg-[#F8F4F8]">
            <div className="flex h-full">
                <div className="border-foreground/10 flex w-[40%] flex-col items-center justify-center space-y-8 border-r px-16">
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={225}
                        height={225}
                        className="h-[225px] w-[225px]"
                    />
                    <h1
                        className="text-7xl font-light tracking-tight"
                        style={{ color: "#5A3C64" }}
                    >
                        Carmenta
                    </h1>
                    <p
                        className="text-lg font-medium tracking-wider uppercase"
                        style={{ color: "#C4A3D4" }}
                    >
                        Heart-Centered AI
                    </p>
                </div>
                <div className="flex w-[60%] flex-col justify-center space-y-10 px-20">
                    <div className="space-y-6">
                        <p
                            className="text-5xl leading-tight font-light"
                            style={{ color: "#5A3C64" }}
                        >
                            Create at the speed of thought.
                        </p>
                        <div className="h-1 w-32" style={{ background: "#C4A3D4" }} />
                    </div>
                    <div className="space-y-4 text-2xl" style={{ color: "#78648A" }}>
                        <p>One subscription, all the best models</p>
                        <p>Your AI concierge for perfect connections</p>
                        <p>Connect your data to AI seamlessly</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
