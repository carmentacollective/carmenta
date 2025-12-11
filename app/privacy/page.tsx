import { Metadata } from "next";

import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
    title: "Your Privacy · Carmenta",
    description: "Carmenta Privacy Policy - How we collect, use, and protect our data.",
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background">
            <SiteHeader bordered />
            {/* Content */}
            <article className="mx-auto max-w-4xl px-6 py-12 sm:px-8 sm:py-16 lg:px-10 lg:py-20">
                <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>

                {/* TL;DR - Transparent Summary */}
                <div className="mt-8 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background p-6">
                    <h2 className="mb-4 text-2xl font-bold">
                        TL;DR - The Straight Truth
                    </h2>
                    <div className="space-y-3">
                        <p className="font-medium">
                            We built Carmenta to be a heart-centered AI interface for
                            builders who work at the speed of thought. Here's what that
                            means for our privacy:
                        </p>

                        <div className="mt-4">
                            <h3 className="mb-2 font-semibold text-green-600 dark:text-green-400">
                                ✓ What we collect:
                            </h3>
                            <ul className="list-disc space-y-1 pl-6 text-sm">
                                <li>Email and name (for our account)</li>
                                <li>
                                    Conversations with AI models (to maintain context
                                    and improve our shared experience)
                                </li>
                                <li>
                                    Model preferences and usage patterns (which models
                                    we use and when)
                                </li>
                                <li>
                                    Technical logs (API requests, timestamps, response
                                    status) for 90 days
                                </li>
                            </ul>
                        </div>

                        <div className="mt-4">
                            <h3 className="mb-2 font-semibold text-red-600 dark:text-red-400">
                                ✗ What we will NEVER do:
                            </h3>
                            <ul className="list-disc space-y-1 pl-6 text-sm">
                                <li>Sell, license, or monetize our data - ever</li>
                                <li>
                                    Train AI models on our conversations without
                                    explicit consent
                                </li>
                                <li>Serve ads or use our data for advertising</li>
                                <li>Build profiles or analyze behavior</li>
                                <li>
                                    Let humans read our conversations (except for
                                    security/legal requirements)
                                </li>
                            </ul>
                        </div>

                        <div className="mt-4">
                            <h3 className="mb-2 font-semibold text-primary">
                                → Our control:
                            </h3>
                            <ul className="list-disc space-y-1 pl-6 text-sm">
                                <li>
                                    Delete conversations or our entire account anytime
                                </li>
                                <li>Export our data whenever we want</li>
                                <li>
                                    Request our data or deletion:{" "}
                                    <a
                                        href="mailto:privacy@carmenta.ai"
                                        className="text-primary hover:underline"
                                    >
                                        privacy@carmenta.ai
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <p className="mt-4 border-t border-primary/20 pt-4 text-sm font-medium">
                            How we work: We unify multiple AI models (Claude, ChatGPT,
                            Gemini, and more) into one interface. Our conversations are
                            stored to maintain context across models and sessions. We
                            route our requests to the best model for each task, always
                            prioritizing our flourishing.
                        </p>
                    </div>
                </div>

                <div className="prose prose-lg dark:prose-invert mt-8 max-w-none">
                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Introduction</h2>
                        <p className="mt-4">
                            Welcome to Carmenta. We're committed to protecting our
                            privacy and being transparent about how we collect, use, and
                            share our information. This Privacy Policy explains our
                            practices regarding data we collect through our service.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Information We Collect</h2>

                        <h3 className="mt-6 text-xl font-semibold">
                            Account Information
                        </h3>
                        <p className="mt-2">When we create an account, we collect:</p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>Email address</li>
                            <li>Name</li>
                            <li>Profile picture (optional)</li>
                            <li>
                                Authentication credentials (managed securely by Clerk)
                            </li>
                        </ul>

                        <h3 className="mt-6 text-xl font-semibold">
                            Conversation Data
                        </h3>
                        <p className="mt-2">
                            When we interact with AI models through Carmenta:
                        </p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>Our messages and prompts</li>
                            <li>AI responses and generated content</li>
                            <li>
                                Conversation metadata (timestamps, model used,
                                conversation threads)
                            </li>
                            <li>Files and attachments we share</li>
                        </ul>

                        <h3 className="mt-6 text-xl font-semibold">Usage Data</h3>
                        <p className="mt-2">
                            We collect information about how we use our service:
                        </p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>Model preferences and selections</li>
                            <li>Feature usage patterns</li>
                            <li>Error logs and diagnostic data</li>
                            <li>Browser type and operating system</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">
                            How We Use Our Information
                        </h2>
                        <p className="mt-4">We use our information to:</p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>Provide and maintain our service</li>
                            <li>
                                Maintain conversation context across sessions and models
                            </li>
                            <li>Route requests to the most appropriate AI model</li>
                            <li>Send service-related notifications and updates</li>
                            <li>Improve our service and develop new features</li>
                            <li>Detect and prevent fraud and abuse</li>
                            <li>Comply with legal obligations</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Data Security</h2>
                        <p className="mt-4">We take security seriously:</p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>
                                <strong>Authentication:</strong> Managed by Clerk with
                                industry-standard security
                            </li>
                            <li>
                                <strong>Encryption:</strong> All data encrypted in
                                transit and at rest
                            </li>
                            <li>
                                <strong>Transmission:</strong> All data transmitted over
                                HTTPS
                            </li>
                            <li>
                                <strong>Access Control:</strong> Strict user isolation -
                                we can only access our own data
                            </li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Third-Party Services</h2>
                        <p className="mt-4">We integrate with third-party services:</p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>
                                <strong>Clerk:</strong> Authentication and user
                                management
                            </li>
                            <li>
                                <strong>AI Model Providers:</strong> Anthropic (Claude),
                                OpenAI (ChatGPT), Google (Gemini), and others
                            </li>
                            <li>
                                <strong>Analytics:</strong> For understanding usage
                                patterns and improving the service
                            </li>
                        </ul>
                        <p className="mt-4">
                            These services have their own privacy policies. Our
                            conversations are processed by AI model providers according
                            to their terms and privacy practices.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Our Rights and Choices</h2>
                        <p className="mt-4">We each have the right to:</p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>
                                <strong>Access:</strong> Request a copy of our data
                            </li>
                            <li>
                                <strong>Correction:</strong> Update incorrect or
                                incomplete data
                            </li>
                            <li>
                                <strong>Deletion:</strong> Request deletion of our
                                account and data
                            </li>
                            <li>
                                <strong>Export:</strong> Download our conversations and
                                data
                            </li>
                            <li>
                                <strong>Opt-out:</strong> Unsubscribe from marketing
                                emails
                            </li>
                        </ul>
                        <p className="mt-4">
                            To exercise these rights, reach out at{" "}
                            <a
                                href="mailto:privacy@carmenta.ai"
                                className="text-primary hover:underline"
                            >
                                privacy@carmenta.ai
                            </a>
                            . We'll respond within 30 days.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">
                            Data Retention and Deletion
                        </h2>
                        <p className="mt-4">We retain our data:</p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>
                                <strong>Account Data:</strong> Until we delete our
                                account
                            </li>
                            <li>
                                <strong>Conversations:</strong> Until we delete them or
                                our account
                            </li>
                            <li>
                                <strong>Usage Logs:</strong> For 90 days (for debugging
                                and analytics)
                            </li>
                            <li>
                                <strong>Legal Requirements:</strong> Longer if required
                                by law
                            </li>
                        </ul>

                        <h3 className="mt-6 text-xl font-semibold">
                            How to Request Data Deletion
                        </h3>
                        <p className="mt-2">To request deletion of our data:</p>
                        <ol className="mt-2 list-decimal space-y-2 pl-6">
                            <li>
                                Email{" "}
                                <a
                                    href="mailto:privacy@carmenta.ai"
                                    className="text-primary hover:underline"
                                >
                                    privacy@carmenta.ai
                                </a>{" "}
                                with the deletion request
                            </li>
                            <li>
                                We'll confirm identity and process the request within 30
                                days
                            </li>
                            <li>
                                All account data, conversations, and settings will be
                                permanently deleted
                            </li>
                            <li>
                                Usage logs will be purged or anonymized within 90 days
                                of deletion
                            </li>
                        </ol>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">International Access</h2>
                        <p className="mt-4">
                            Our service is hosted in the United States. When accessing
                            from outside the US, information will be transferred to,
                            stored, and processed in the US where our servers are
                            located.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Age Requirements</h2>
                        <p className="mt-4">
                            Carmenta is built for adults creating meaningful work. We
                            don't knowingly collect information from anyone under 13. If
                            we discover we've collected such information, we'll delete
                            it promptly.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Changes to This Policy</h2>
                        <p className="mt-4">
                            We may update this Privacy Policy from time to time. We'll
                            notify ourselves of significant changes by:
                        </p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>Posting the new policy on this page</li>
                            <li>Updating the "Last updated" date</li>
                            <li>Sending an email notification (for major changes)</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Contact Us</h2>
                        <p className="mt-4">
                            Questions about this Privacy Policy? Contact us:
                        </p>
                        <ul className="mt-2 space-y-2">
                            <li>
                                Privacy Inquiries:{" "}
                                <a
                                    href="mailto:privacy@carmenta.ai"
                                    className="text-primary hover:underline"
                                >
                                    privacy@carmenta.ai
                                </a>
                            </li>
                            <li>
                                General Support:{" "}
                                <a
                                    href="mailto:care@carmenta.ai"
                                    className="text-primary hover:underline"
                                >
                                    care@carmenta.ai
                                </a>
                            </li>
                        </ul>
                    </section>

                    <footer className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
                        <p>Last updated: December 9, 2025</p>
                    </footer>
                </div>
            </article>
            <Footer />
        </div>
    );
}
