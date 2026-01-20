"use client";

/**
 * OracleMenu - Carmenta speaks through this menu
 *
 * The Oracle represents Carmenta herself. This menu contains:
 * - Carmenta features (AI Team, Guide)
 * - Philosophy and company info
 * - Legal/support links
 *
 * The User menu (UserAuthButton) handles personal stuff:
 * - New Connection, account, integrations, knowledge base, theme, logout
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
    UsersIcon,
    CompassIcon,
    HeartIcon,
    CodeIcon,
    GithubLogoIcon,
    ShieldIcon,
    FileTextIcon,
    LockIcon,
    HouseIcon,
    SparkleIcon,
} from "@phosphor-icons/react";

import { useCarmentaModal } from "@/hooks/use-carmenta-modal";

import { cn } from "@/lib/utils";
import { glassOrbPreset } from "@/lib/design-tokens";

// Track whether we're on the client
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface OracleMenuProps {
    /** Additional classes for the container */
    className?: string;
    /** Show the "Carmenta" text next to the Oracle */
    showLabel?: boolean;
}

/**
 * Oracle menu - Carmenta's voice
 *
 * Tap the Oracle to access product features, help, and philosophy.
 * Glass morphism design matching the holographic theme.
 */
export function OracleMenu({ className, showLabel = false }: OracleMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const { open: openCarmenta } = useCarmentaModal();

    // Update dropdown position when opening
    useEffect(() => {
        if (!isOpen || !triggerRef.current) return;

        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (rect) {
                setDropdownPosition({
                    top: rect.bottom + 8, // 8px gap
                    left: rect.left,
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

    // Render dropdown via portal
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

                          {/* Dropdown menu */}
                          <motion.div
                              className="z-modal fixed"
                              style={{
                                  top: dropdownPosition.top,
                                  left: dropdownPosition.left,
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
                                  {/* Header - Carmenta identity */}
                                  <div className="border-foreground/10 border-b px-4 py-3">
                                      <div className="flex items-center gap-3">
                                          <div className="from-primary/20 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br to-cyan-500/20">
                                              <Image
                                                  src="/logos/icon-transparent.png"
                                                  alt="Carmenta"
                                                  width={28}
                                                  height={28}
                                              />
                                          </div>
                                          <div>
                                              <div className="text-foreground text-sm font-medium">
                                                  Carmenta
                                              </div>
                                              <div className="text-foreground/60 text-xs">
                                                  Heart-centered AI
                                              </div>
                                          </div>
                                      </div>
                                  </div>

                                  {/* Menu items */}
                                  <div className="py-1">
                                      {/* Home - standard logo navigation */}
                                      <Link
                                          href="/home"
                                          onClick={() => setIsOpen(false)}
                                          className="group text-foreground/80 hover:text-foreground relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                                      >
                                          <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                          <HouseIcon className="text-foreground/60 relative h-4 w-4" />
                                          <span className="relative">Home</span>
                                      </Link>

                                      {/* Ask Carmenta - quick access */}
                                      <button
                                          onClick={() => {
                                              setIsOpen(false);
                                              openCarmenta();
                                          }}
                                          className="group text-foreground relative flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition-all"
                                      >
                                          <div className="bg-primary/10 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                          <span className="relative flex items-center gap-3">
                                              <SparkleIcon
                                                  className="text-primary h-4 w-4"
                                                  weight="duotone"
                                              />
                                              Ask Carmenta
                                          </span>
                                          <kbd className="bg-foreground/5 text-foreground/50 relative rounded px-1.5 py-0.5 font-mono text-[10px]">
                                              ⌘K
                                          </kbd>
                                      </button>

                                      <div className="border-foreground/10 my-1 border-t" />

                                      {/* Carmenta Features */}
                                      <Link
                                          href="/ai-team"
                                          onClick={() => setIsOpen(false)}
                                          className="group text-foreground/80 hover:text-foreground relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                                      >
                                          <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                          <UsersIcon className="text-foreground/60 relative h-4 w-4" />
                                          <span className="relative">AI Team</span>
                                      </Link>

                                      <Link
                                          href="/guide"
                                          onClick={() => setIsOpen(false)}
                                          className="group text-foreground/80 hover:text-foreground relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                                      >
                                          <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                          <CompassIcon className="text-foreground/60 relative h-4 w-4" />
                                          <span className="relative">Guide</span>
                                      </Link>

                                      <div className="border-foreground/10 my-1 border-t" />

                                      {/* Philosophy & Company */}
                                      <Link
                                          href="/heart-centered-ai"
                                          onClick={() => setIsOpen(false)}
                                          className="group text-foreground/80 hover:text-foreground relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                                      >
                                          <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                          <HeartIcon
                                              className="text-primary relative h-4 w-4"
                                              weight="fill"
                                          />
                                          <span className="relative">
                                              Heart-Centered AI
                                          </span>
                                      </Link>

                                      <Link
                                          href="/ai-first-development"
                                          onClick={() => setIsOpen(false)}
                                          className="group text-foreground/80 hover:text-foreground relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                                      >
                                          <div className="bg-primary/5 pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                                          <CodeIcon className="text-foreground/60 relative h-4 w-4" />
                                          <span className="relative">How We Build</span>
                                      </Link>

                                      {/* Footer links - compact row */}
                                      <div className="border-foreground/10 border-t px-4 py-3">
                                          <div className="text-foreground/50 flex items-center gap-3 text-xs">
                                              <Link
                                                  href="https://github.com/carmentacollective/carmenta"
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  onClick={() => setIsOpen(false)}
                                                  className="hover:text-foreground/80 flex items-center gap-1 transition-colors"
                                              >
                                                  <GithubLogoIcon className="h-3 w-3" />
                                                  Source
                                              </Link>
                                              <span className="text-foreground/20">
                                                  ·
                                              </span>
                                              <Link
                                                  href="/privacy"
                                                  onClick={() => setIsOpen(false)}
                                                  className="hover:text-foreground/80 flex items-center gap-1 transition-colors"
                                              >
                                                  <LockIcon className="h-3 w-3" />
                                                  Privacy
                                              </Link>
                                              <span className="text-foreground/20">
                                                  ·
                                              </span>
                                              <Link
                                                  href="/terms"
                                                  onClick={() => setIsOpen(false)}
                                                  className="hover:text-foreground/80 flex items-center gap-1 transition-colors"
                                              >
                                                  <FileTextIcon className="h-3 w-3" />
                                                  Terms
                                              </Link>
                                              <span className="text-foreground/20">
                                                  ·
                                              </span>
                                              <Link
                                                  href="/security"
                                                  onClick={() => setIsOpen(false)}
                                                  className="hover:text-foreground/80 flex items-center gap-1 transition-colors"
                                              >
                                                  <ShieldIcon className="h-3 w-3" />
                                                  Security
                                              </Link>
                                          </div>
                                      </div>
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
        <div className={cn("vt-oracle-menu flex items-center", className)}>
            {/* Clickable area: orb + optional label */}
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className="group flex cursor-pointer items-center gap-3"
                aria-label="Carmenta menu"
                // Only show tooltip when label is hidden (icon-only state)
                {...(!showLabel && {
                    "data-tooltip-id": "tip",
                    "data-tooltip-content": "Carmenta",
                })}
            >
                {/* Oracle orb */}
                <div className={cn(glassOrbPreset)}>
                    <Image
                        src="/logos/icon-transparent.png"
                        alt="Carmenta"
                        width={28}
                        height={28}
                        className="pointer-events-none transition-transform duration-300 group-hover:scale-110"
                    />
                </div>

                {/* Optional label - now clickable */}
                {showLabel && (
                    <span className="text-foreground/90 group-hover:text-foreground text-xl font-semibold tracking-tight transition-colors">
                        Carmenta
                    </span>
                )}
            </button>

            {/* Dropdown rendered via portal */}
            {dropdownContent}
        </div>
    );
}
