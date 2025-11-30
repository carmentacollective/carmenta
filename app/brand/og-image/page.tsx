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
        <div
            className="flex h-screen w-screen items-center justify-center"
            style={{ width: "1200px", height: "630px" }}
        >
            <div className="absolute inset-0 bg-[#F8F4F8]">
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
                        <h1
                            className="text-6xl font-light tracking-tight"
                            style={{ color: "#5A3C64" }}
                        >
                            Carmenta
                        </h1>
                    </div>
                    {/* Right side - Message */}
                    <div className="flex w-1/2 flex-col justify-center space-y-8 px-16">
                        <div className="space-y-4">
                            <p
                                className="text-3xl font-normal"
                                style={{ color: "#5A3C64", lineHeight: "1.3" }}
                            >
                                One Interface.
                                <br />
                                All AI Models.
                                <br />
                                Complete Memory.
                            </p>
                        </div>
                        <p
                            className="text-xl"
                            style={{ color: "#8A7A9C", lineHeight: "1.5" }}
                        >
                            Heart-centered AI for builders who work at the speed of
                            thought
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
