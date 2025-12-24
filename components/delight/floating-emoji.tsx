"use client";

/**
 * FloatingEmoji - iMessage-style floating emoji effects
 *
 * Creates a burst of floating emojis that rise and fade out,
 * similar to iMessage screen effects. Used for secret phrase
 * easter eggs and moments of delight.
 */

import {
    useState,
    useCallback,
    createContext,
    useContext,
    useSyncExternalStore,
    useRef,
    useEffect,
} from "react";
import { createPortal } from "react-dom";

interface FloatingEmojiConfig {
    emoji: string;
    count?: number;
    /** Duration in ms for full animation */
    duration?: number;
}

interface FloatingEmojiState extends FloatingEmojiConfig {
    id: string;
    particles: Array<{
        id: number;
        x: number;
        y: number;
        scale: number;
        delay: number;
        rotation: number;
        drift: number;
    }>;
}

interface FloatingEmojiContextValue {
    trigger: (config: FloatingEmojiConfig) => void;
}

const FloatingEmojiContext = createContext<FloatingEmojiContextValue | null>(null);

export function useFloatingEmoji() {
    const context = useContext(FloatingEmojiContext);
    if (!context) {
        throw new Error("useFloatingEmoji must be used within FloatingEmojiProvider");
    }
    return context;
}

/**
 * Provider that manages floating emoji effects globally.
 * Wrap your app in this to enable emoji effects anywhere.
 */
// Client-side mounting detection without setState in effect
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function FloatingEmojiProvider({ children }: { children: React.ReactNode }) {
    const [effects, setEffects] = useState<FloatingEmojiState[]>([]);
    const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // Cleanup all timeouts on unmount
    useEffect(() => {
        return () => {
            timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
            timeoutsRef.current.clear();
        };
    }, []);

    const trigger = useCallback((config: FloatingEmojiConfig) => {
        const count = config.count ?? 12;
        const duration = config.duration ?? 3000;

        const particles = Array.from({ length: count }, (_, i) => ({
            id: i,
            // Spread across the bottom of the screen
            x: 10 + Math.random() * 80, // 10-90% of screen width
            y: 100 + Math.random() * 10, // Start just below viewport
            scale: 0.6 + Math.random() * 0.8, // 0.6 - 1.4x scale
            delay: Math.random() * 0.5, // 0 - 0.5s stagger
            rotation: -30 + Math.random() * 60, // -30 to 30 degrees
            drift: -20 + Math.random() * 40, // Horizontal drift
        }));

        const id = `${Date.now()}-${Math.random()}`;
        const effect: FloatingEmojiState = {
            ...config,
            id,
            particles,
            duration,
        };

        setEffects((prev) => [...prev, effect]);

        // Clean up after animation
        const timeout = setTimeout(() => {
            setEffects((prev) => prev.filter((e) => e.id !== id));
            timeoutsRef.current.delete(id);
        }, duration + 500);

        timeoutsRef.current.set(id, timeout);
    }, []);

    return (
        <FloatingEmojiContext.Provider value={{ trigger }}>
            {children}
            {mounted &&
                createPortal(
                    <div className="pointer-events-none fixed inset-0 z-toast overflow-hidden">
                        {effects.map((effect) => (
                            <div key={effect.id} className="absolute inset-0">
                                {effect.particles.map((particle) => (
                                    <span
                                        key={particle.id}
                                        className="absolute animate-float-up select-none text-3xl sm:text-4xl"
                                        style={{
                                            left: `${particle.x}%`,
                                            top: `${particle.y}%`,
                                            transform: `scale(${particle.scale}) rotate(${particle.rotation}deg)`,
                                            animationDelay: `${particle.delay}s`,
                                            animationDuration: `${(effect.duration ?? 3000) / 1000}s`,
                                            // CSS custom property for horizontal drift
                                            ["--drift" as string]: `${particle.drift}px`,
                                        }}
                                    >
                                        {effect.emoji}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>,
                    document.body
                )}
        </FloatingEmojiContext.Provider>
    );
}
