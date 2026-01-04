"use client";

import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import {
    User,
    LogOut,
    Moon,
    Sun,
    UserCircle2,
    Monitor,
    Plug,
    Sparkles,
    BookOpen,
    MessageSquare,
    MessageCircle,
} from "lucide-react";

import { useMarker } from "@/components/feedback/marker-provider";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { glassOrbPreset } from "@/lib/design-tokens";
import {
    useThemeVariant,
    getCurrentHoliday,
    type ThemeVariant,
} from "@/lib/theme/theme-context";

// Track whether we're on the client
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface UserAuthButtonProps {
    /** Additional classes for the container */
    className?: string;
}

/**
 * Unified user authentication button used across all pages.
 *
 * When signed in: Shows user icon with dropdown (account, integrations, theme, sign out)
 * When signed out: Shows "Sign In" button linking to /sign-in
 *
 * Glass morphism design matching the holographic theme.
 */
export function UserAuthButton({ className }: UserAuthButtonProps) {
    const { isLoaded, isSignedIn } = useAuth();
    const { user } = useUser();
    const { openUserProfile } = useClerk();
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredTheme, setHoveredTheme] = useState<ThemeVariant | null>(null);
    const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const { theme, setTheme } = useTheme();
    const { themeVariant, setThemeVariant } = useThemeVariant();
    const { capture: captureMarker, isReady: isMarkerReady } = useMarker();
    // Track the "committed" theme (what user has actually selected, not just hovering)
    const [committedTheme, setCommittedTheme] = useState<ThemeVariant>(themeVariant);
    // Ref for positioning the portal dropdown
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

    // Update dropdown position when opening
    useEffect(() => {
        if (!isOpen || !triggerRef.current) return;

        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (rect) {
                setDropdownPosition({
                    top: rect.bottom + 8, // 8px gap (mt-2)
                    right: window.innerWidth - rect.right,
                });
            }
        };

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);

        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [isOpen]);

    // Close menu on Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    // Show nothing while loading to prevent flash
    if (!isLoaded) {
        return <div className={cn("h-10 w-10", className)} aria-hidden="true" />;
    }

    // Not signed in - show Enter button
    if (!isSignedIn || !user) {
        return (
            <Link
                href="/enter"
                className={cn("btn-cta rounded-full px-4 py-2 text-sm", className)}
            >
                Enter
            </Link>
        );
    }

    // Signed in - show user dropdown
    const profileImageUrl = user.imageUrl;
    const displayName = user.fullName || user.firstName || "User";
    const email = user.primaryEmailAddress?.emailAddress;

    const themeOptions = [
        { value: "light", label: "Light", icon: Sun },
        { value: "dark", label: "Dark", icon: Moon },
        { value: "system", label: "System", icon: Monitor },
    ] as const;

    // Theme variants with primary color for swatch preview
    // Colors derived from --primary HSL values in globals.css (light mode)
    const currentHoliday = getCurrentHoliday();
    const themeVariants: Array<{
        value: ThemeVariant;
        label: string;
        description: string;
        color: string; // Primary color for the swatch
    }> = [
        {
            value: "carmenta",
            label: "Carmenta",
            description: "Royal purple elegance",
            color: "hsl(270 40% 56%)",
        },
        {
            value: "warm-earth",
            label: "Warm Earth",
            description: "Grounded, organic",
            color: "hsl(15 60% 60%)",
        },
        {
            value: "arctic-clarity",
            label: "Arctic Clarity",
            description: "Crystalline precision",
            color: "hsl(200 70% 55%)",
        },
        {
            value: "forest-wisdom",
            label: "Forest Wisdom",
            description: "Natural intelligence",
            color: "hsl(140 45% 45%)",
        },
        {
            value: "monochrome",
            label: "Monochrome",
            description: "Minimal, precise",
            color: "hsl(0 0% 35%)",
        },
        {
            value: "holiday",
            label: currentHoliday.label,
            description: currentHoliday.description,
            color: currentHoliday.colors[0], // Primary color from current holiday
        },
    ];

    // Show hovered theme info when hovering, otherwise selected theme
    const displayTheme = themeVariants.find(
        (v) => v.value === (hoveredTheme ?? themeVariant)
    );

    // Render dropdown via portal to escape stacking context constraints
    // Portal always renders when client-side so AnimatePresence can detect exits
    const dropdownContent = isClient
        ? createPortal(
              <AnimatePresence>
                  {isOpen && (
                      <>
                          {/* Backdrop */}
                          <motion.div
                              className="z-backdrop fixed inset-0 bg-black/30"
                              onClick={() => setIsOpen(false)}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                          />

                          {/* Dropdown menu - positioned via portal */}
                          <motion.div
                              className="z-modal fixed"
                              style={{
                                  top: dropdownPosition.top,
                                  right: dropdownPosition.right,
                              }}
                              initial={{ opacity: 0, y: -12, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.98 }}
                              transition={{
                                  duration: 0.2,
                                  ease: [0.16, 1, 0.3, 1],
                              }}
                          >
                              <div className="glass-container-mobile w-64 overflow-hidden rounded-2xl shadow-2xl">
                                  {/* User info header */}
                                  <div className="border-foreground/10 border-b px-4 py-3">
                                      <div className="flex items-center gap-3">
                                          {profileImageUrl ? (
                                              <img
                                                  src={profileImageUrl}
                                                  alt={displayName}
                                                  className="h-10 w-10 rounded-full object-cover"
                                              />
                                          ) : (
                                              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold">
                                                  {displayName.charAt(0).toUpperCase()}
                                              </div>
                                          )}
                                          <div className="flex-1 overflow-hidden">
                                              <div className="text-foreground truncate text-sm font-medium">
                                                  {displayName}
                                              </div>
                                              <div className="text-foreground/60 truncate text-xs">
                                                  {email}
                                              </div>
                                          </div>
                                      </div>
                                  </div>

                                  {/* Menu items */}
                                  <div className="py-1">
                                      {/* Primary action: Back to Chat */}
                                      <Link
                                          href="/connection"
                                          onClick={() => setIsOpen(false)}
                                          className="group text-foreground relative flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all"
                                      >
                                          <div className="bg-primary/10 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                          <MessageCircle className="text-primary relative h-4 w-4" />
                                          <span className="relative">Connect</span>
                                      </Link>

                                      {/* Your Data - things Carmenta knows about you */}
                                      <div className="border-foreground/10 my-1 border-t" />

                                      <Link
                                          href="/knowledge-base"
                                          onClick={() => setIsOpen(false)}
                                          className="group text-foreground/80 hover:text-foreground relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                                      >
                                          <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                          <BookOpen className="text-foreground/60 relative h-4 w-4" />
                                          <span className="relative">
                                              Knowledge Base
                                          </span>
                                      </Link>

                                      <Link
                                          href="/integrations"
                                          onClick={() => setIsOpen(false)}
                                          className="group text-foreground/80 hover:text-foreground relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                                      >
                                          <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                          <Plug className="text-foreground/60 relative h-4 w-4" />
                                          <span className="relative">Integrations</span>
                                      </Link>

                                      <Link
                                          href="/communication"
                                          onClick={() => setIsOpen(false)}
                                          className="group text-foreground/80 hover:text-foreground relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                                      >
                                          <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                          <MessageSquare className="text-foreground/60 relative h-4 w-4" />
                                          <span className="relative">
                                              Communication
                                          </span>
                                      </Link>

                                      {/* Account & Appearance */}
                                      <div className="border-foreground/10 my-1 border-t" />

                                      <button
                                          onClick={() => {
                                              openUserProfile();
                                              setIsOpen(false);
                                          }}
                                          className="group text-foreground/80 hover:text-foreground relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                                      >
                                          <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                          <User className="text-foreground/60 relative h-4 w-4" />
                                          <span className="relative">Account</span>
                                      </button>

                                      {/* Appearance section - compact redesign */}
                                      {isClient && (
                                          <div className="border-foreground/10 border-t px-4 py-3">
                                              {/* Header row: "Theme" label + Light/Dark/System segmented control */}
                                              <div className="mb-3 flex items-center justify-between">
                                                  <span className="text-foreground/50 text-xs font-medium">
                                                      Theme
                                                  </span>

                                                  {/* Segmented control for light/dark/system */}
                                                  <div className="bg-foreground/5 flex rounded-lg p-0.5">
                                                      {themeOptions.map((option) => {
                                                          const isSelected =
                                                              theme === option.value;
                                                          const Icon = option.icon;
                                                          return (
                                                              <button
                                                                  key={option.value}
                                                                  onClick={() =>
                                                                      setTheme(
                                                                          option.value
                                                                      )
                                                                  }
                                                                  className={cn(
                                                                      "flex items-center justify-center rounded-md px-2 py-1 transition-all",
                                                                      isSelected
                                                                          ? "bg-background text-foreground shadow-sm"
                                                                          : "text-foreground/40 hover:text-foreground/70"
                                                                  )}
                                                                  data-tooltip-id="tip"
                                                                  data-tooltip-content={
                                                                      option.label
                                                                  }
                                                              >
                                                                  <Icon className="h-3.5 w-3.5" />
                                                              </button>
                                                          );
                                                      })}
                                                  </div>
                                              </div>

                                              {/* Theme swatches row */}
                                              <div
                                                  className="flex items-center gap-2"
                                                  onMouseLeave={() => {
                                                      // Restore to committed theme when leaving swatch area
                                                      setHoveredTheme(null);
                                                      setThemeVariant(committedTheme);
                                                  }}
                                              >
                                                  {themeVariants.map((variant) => {
                                                      const isCommitted =
                                                          committedTheme ===
                                                          variant.value;
                                                      return (
                                                          <button
                                                              key={variant.value}
                                                              onClick={() => {
                                                                  setCommittedTheme(
                                                                      variant.value
                                                                  );
                                                                  setThemeVariant(
                                                                      variant.value
                                                                  );
                                                              }}
                                                              onMouseEnter={() => {
                                                                  setHoveredTheme(
                                                                      variant.value
                                                                  );
                                                                  setThemeVariant(
                                                                      variant.value
                                                                  );
                                                              }}
                                                              className={cn(
                                                                  "h-10 w-10 rounded-full transition-all",
                                                                  isCommitted
                                                                      ? "ring-foreground/60 ring-offset-background ring-2 ring-offset-2"
                                                                      : "opacity-60 hover:scale-110 hover:opacity-100"
                                                              )}
                                                              style={{
                                                                  backgroundColor:
                                                                      variant.color,
                                                              }}
                                                              data-tooltip-id="tip"
                                                              data-tooltip-content={
                                                                  variant.label
                                                              }
                                                          />
                                                      );
                                                  })}
                                              </div>

                                              {/* Theme label + description (updates on hover) */}
                                              <div className="mt-3">
                                                  <div className="text-foreground/80 text-sm font-medium">
                                                      {displayTheme?.label}
                                                  </div>
                                                  <div className="text-foreground/50 text-xs">
                                                      {displayTheme?.description}
                                                  </div>
                                              </div>
                                          </div>
                                      )}

                                      {/* Meta actions */}
                                      <div className="border-foreground/10 border-t">
                                          <button
                                              onClick={() => {
                                                  captureMarker();
                                                  setIsOpen(false);
                                              }}
                                              disabled={!isMarkerReady}
                                              className="group text-foreground/80 hover:text-foreground relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all disabled:opacity-50"
                                          >
                                              <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                              <Sparkles className="text-foreground/60 relative h-4 w-4" />
                                              <span className="relative">
                                                  Improve Carmenta
                                              </span>
                                          </button>
                                      </div>

                                      <Link
                                          href="/exit"
                                          onClick={() => setIsOpen(false)}
                                          className="group text-foreground/80 hover:text-foreground relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                                      >
                                          <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                          <LogOut className="text-foreground/60 relative h-4 w-4" />
                                          <span className="relative">Exit</span>
                                      </Link>
                                  </div>
                              </div>
                          </motion.div>
                      </>
                  )}
              </AnimatePresence>,
              document.body
          )
        : null;

    return (
        <div className={cn("vt-user-auth", className)}>
            {/* User avatar - glass orb anchoring the header */}
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(glassOrbPreset, "group")}
                aria-label="User menu"
                data-tooltip-id="tip"
                data-tooltip-content="Settings & integrations"
            >
                <UserCircle2 className="text-foreground/50 group-hover:text-foreground/80 h-5 w-5 transition-colors sm:h-6 sm:w-6 md:h-7 md:w-7" />
            </button>

            {/* Dropdown rendered via portal to escape stacking contexts */}
            {dropdownContent}
        </div>
    );
}
