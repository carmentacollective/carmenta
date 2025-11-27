import { Code2, Github, Heart } from "lucide-react";
import Link from "next/link";

export function Footer() {
    return (
        <footer className="border-t border-border px-6 py-8">
            <div className="mx-auto flex max-w-2xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                {/* Links */}
                <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <Link
                        href="/ai-first-development"
                        className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                    >
                        <Code2 className="h-3.5 w-3.5" />
                        <span>How We Build</span>
                    </Link>
                    <Link
                        href="https://heartcentered.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                    >
                        <Heart className="h-3.5 w-3.5" />
                        <span>Principles</span>
                    </Link>
                    <Link
                        href="https://github.com/carmentacollective/carmenta"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                    >
                        <Github className="h-3.5 w-3.5" />
                        <span>Source</span>
                    </Link>
                </nav>

                {/* Credits */}
                <div className="text-sm text-muted-foreground">
                    <span>Built with </span>
                    <Heart className="inline h-3 w-3 fill-current text-primary" />
                    <span> by </span>
                    <Link
                        href="https://technick.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-foreground"
                    >
                        technick.ai
                    </Link>
                </div>
            </div>
        </footer>
    );
}
