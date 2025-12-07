import { Code2, Github, Heart } from "lucide-react";
import Link from "next/link";

export function Footer() {
    return (
        <footer className="px-6 py-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                {/* Links */}
                <nav className="flex flex-wrap items-center gap-6 text-base text-foreground/60">
                    <Link
                        href="/ai-first-development"
                        className="flex items-center gap-1.5 transition-colors hover:text-foreground/90"
                    >
                        <Code2 className="h-3.5 w-3.5" />
                        <span>How We Build</span>
                    </Link>
                    <Link
                        href="https://heartcentered.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 transition-colors hover:text-foreground/90"
                    >
                        <Heart className="h-3.5 w-3.5" />
                        <span>Heart Centered AI</span>
                    </Link>
                    <Link
                        href="https://github.com/carmentacollective/carmenta"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 transition-colors hover:text-foreground/90"
                    >
                        <Github className="h-3.5 w-3.5" />
                        <span>Source</span>
                    </Link>
                </nav>

                {/* Credits */}
                <div className="text-base text-foreground/60">
                    <span>Built with </span>
                    <Heart className="inline h-3 w-3 fill-primary text-primary" />
                    <span> by </span>
                    <Link
                        href="https://technick.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-foreground/90"
                    >
                        technick.ai
                    </Link>
                </div>
            </div>
        </footer>
    );
}
