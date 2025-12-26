"use client";

import { useEffect } from "react";

/**
 * Pre-hydration loading indicator that shows immediately when HTML loads,
 * before React/JavaScript hydrates. Uses the "Breathing + Orbital" design:
 * a large breathing logo with an orbiting dot.
 *
 * Key timing sync:
 * - Breathing: 8.8s (matches oracle-breathing animation)
 * - Orbital: 4.4s (2 complete orbits per breath cycle)
 *
 * The loader is rendered as inline HTML/CSS that works without JS,
 * then removed after React hydration completes.
 */
export function PreHydrationLoader() {
    useEffect(() => {
        // React has hydrated - remove the pre-loader
        const preLoader = document.getElementById("pre-hydration-loader");
        if (preLoader) {
            // Fade out gracefully
            preLoader.style.opacity = "0";
            preLoader.style.transition = "opacity 0.3s ease-out";
            setTimeout(() => {
                preLoader.remove();
            }, 300);
        }
    }, []);

    // This HTML renders server-side and shows immediately
    // The inline styles ensure it works before any CSS loads
    return (
        <div
            id="pre-hydration-loader"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
                __html: `
<style>
  @keyframes preLoaderBreathe {
    0%, 100% { transform: scale(0.95); }
    50% { transform: scale(1.05); }
  }
  @keyframes preLoaderSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes preLoaderFadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  #pre-hydration-loader {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: hsl(320 20% 97%);
    opacity: 0;
    animation: preLoaderFadeIn 0.4s ease-out 0.3s forwards;
  }
  @media (prefers-color-scheme: dark) {
    #pre-hydration-loader {
      background: hsl(300 25% 8%);
    }
    #pre-hydration-loader .orbit-path {
      border-color: hsl(270 40% 56% / 0.15) !important;
    }
    #pre-hydration-loader .orbit-dot {
      box-shadow: 0 0 24px hsl(270 60% 65% / 0.6) !important;
    }
  }
</style>
<div style="position: relative; width: min(50vh, 70vw); height: min(50vh, 70vw);">
  <!-- Orbiting dot (4.4s = 2 orbits per 8.8s breath) -->
  <div style="position: absolute; inset: -4%; animation: preLoaderSpin 4.4s linear infinite;">
    <div class="orbit-dot" style="
      position: absolute;
      top: 0;
      left: 50%;
      width: min(2vh, 12px);
      height: min(2vh, 12px);
      margin-left: min(-1vh, -6px);
      border-radius: 50%;
      background: linear-gradient(135deg, hsl(270 60% 65%), hsl(240 60% 65%));
      box-shadow: 0 0 20px hsl(270 60% 65% / 0.5);
    "></div>
  </div>
  <!-- Subtle orbit path -->
  <div class="orbit-path" style="position: absolute; inset: -4%; border-radius: 50%; border: 1px solid hsl(270 40% 56% / 0.08);"></div>
  <!-- Large breathing container (8.8s cycle) -->
  <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
              animation: preLoaderBreathe 8.8s ease-in-out infinite;">
    <img src="/logos/icon-transparent.png" alt="" style="width: 100%; height: 100%;" />
  </div>
</div>
`,
            }}
        />
    );
}
