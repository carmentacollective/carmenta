"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/hooks/use-haptic-feedback";
import { createRipple, getTapPosition } from "@/lib/hooks/use-tap-feedback";

const buttonVariants = cva(
    // Base: tap-target provides iOS-native tap feedback (scale, touch-action, etc.)
    "tap-target inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all interactive-focus disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                outline:
                    "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                // Link variant: override tap-target active state
                link: "text-primary underline-offset-4 hover:underline active:scale-100",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-md px-3",
                lg: "h-11 rounded-md px-8",
                icon: "h-10 w-10",
                "icon-sm": "size-8",
                "icon-lg": "size-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

export interface ButtonProps
    extends
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    /** Enable haptic feedback on iOS (default: true) */
    haptic?: boolean;
    /** Enable ripple effect on tap (default: false for buttons, they have solid backgrounds) */
    ripple?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant,
            size,
            asChild = false,
            haptic = true,
            ripple = false,
            onMouseDown,
            onTouchStart,
            ...props
        },
        ref
    ) => {
        const internalRef = React.useRef<HTMLButtonElement>(null);
        // Prevent double feedback from touch + mouse events on touch devices
        const touchedRef = React.useRef(false);

        const handleTapStart = React.useCallback(
            (
                e:
                    | React.MouseEvent<HTMLButtonElement>
                    | React.TouchEvent<HTMLButtonElement>
            ) => {
                // Trigger haptic feedback on iOS
                if (haptic) {
                    triggerHaptic();
                }

                // Optionally create ripple effect (handles reduced motion internally)
                if (ripple && internalRef.current) {
                    const { x, y } = getTapPosition(e, internalRef.current);
                    createRipple(internalRef.current, x, y, {
                        color: "hsl(var(--primary-foreground) / 0.2)",
                    });
                }
            },
            [haptic, ripple]
        );

        const handleTouchStart = React.useCallback(
            (e: React.TouchEvent<HTMLButtonElement>) => {
                touchedRef.current = true;
                handleTapStart(e);
                onTouchStart?.(e);
            },
            [handleTapStart, onTouchStart]
        );

        const handleMouseDown = React.useCallback(
            (e: React.MouseEvent<HTMLButtonElement>) => {
                // Skip if this is a synthesized mousedown from touch
                if (touchedRef.current) {
                    touchedRef.current = false;
                    onMouseDown?.(e);
                    return;
                }
                handleTapStart(e);
                onMouseDown?.(e);
            },
            [handleTapStart, onMouseDown]
        );

        const Comp = asChild ? Slot : "button";

        // For asChild, merge refs so ripple effect works
        if (asChild) {
            return (
                <Comp
                    className={cn(buttonVariants({ variant, size, className }))}
                    ref={(node: HTMLButtonElement | null) => {
                        // Assign to internal ref for ripple
                        (
                            internalRef as React.MutableRefObject<HTMLButtonElement | null>
                        ).current = node;
                        // Forward to external ref
                        if (typeof ref === "function") {
                            ref(node);
                        } else if (ref) {
                            (
                                ref as React.MutableRefObject<HTMLButtonElement | null>
                            ).current = node;
                        }
                    }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    {...props}
                />
            );
        }

        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={(node) => {
                    (
                        internalRef as React.MutableRefObject<HTMLButtonElement | null>
                    ).current = node;
                    if (typeof ref === "function") {
                        ref(node);
                    } else if (ref) {
                        (
                            ref as React.MutableRefObject<HTMLButtonElement | null>
                        ).current = node;
                    }
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };
