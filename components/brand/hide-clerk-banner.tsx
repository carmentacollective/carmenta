"use client";

export function HideClerkBanner() {
    return (
        <style jsx global>{`
            .cl-internal-b3fm6y,
            [data-clerk-banner],
            div[style*="z-index: 99999"],
            .cl-rootBox > div:first-child,
            .cl-component {
                display: none !important;
            }
        `}</style>
    );
}
