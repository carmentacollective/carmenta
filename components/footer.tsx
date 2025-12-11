import { Code2, Github, Heart } from "lucide-react";
import Link from "next/link";

import { ThemeSwitcher } from "@/components/ui";

export function Footer() {
    return (
        <footer className="px-6 py-8 sm:py-10">
            <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
                {/* Links - grouped for visual hierarchy */}
                <nav className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-foreground/60">
                    {/* Primary links with icons */}
                    <Link
                        href="/ai-first-development"
                        className="flex items-center gap-2 transition-all hover:scale-105 hover:text-foreground/90"
                    >
                        <Code2 className="h-4 w-4" />
                        <span>How We Build</span>
                    </Link>
                    <Link
                        href="https://heartcentered.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 transition-all hover:scale-105 hover:text-foreground/90"
                    >
                        <Heart className="h-4 w-4 fill-primary text-primary" />
                        <span>Heart Centered AI</span>
                    </Link>
                    <Link
                        href="https://github.com/carmentacollective/carmenta"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 transition-all hover:scale-105 hover:text-foreground/90"
                    >
                        <Github className="h-4 w-4" />
                        <span>Source</span>
                    </Link>

                    {/* Secondary links - legal */}
                    <div className="flex items-center gap-6">
                        <Link
                            href="/privacy"
                            className="transition-all hover:scale-105 hover:text-foreground/90"
                        >
                            Privacy
                        </Link>
                        <Link
                            href="/security"
                            className="transition-all hover:scale-105 hover:text-foreground/90"
                        >
                            Security
                        </Link>
                        <Link
                            href="/terms"
                            className="transition-all hover:scale-105 hover:text-foreground/90"
                        >
                            Terms
                        </Link>
                    </div>

                    {/* Theme switcher */}
                    <ThemeSwitcher />
                </nav>

                {/* Credits */}
                <div className="text-sm text-foreground/60">
                    <span>Built with </span>
                    <Heart className="inline h-3.5 w-3.5 fill-primary text-primary" />
                    <span> by </span>
                    <Link
                        href="https://technick.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-all hover:scale-105 hover:text-foreground/90"
                    >
                        technick.ai
                    </Link>
                </div>
            </div>
        </footer>
    );
}
