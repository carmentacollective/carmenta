import { Metadata } from "next";
import {
    Shield,
    Lock,
    CheckCircle2,
    KeyRound,
    Eye,
    Server,
    Zap,
    ShieldCheck,
    ExternalLink,
} from "lucide-react";

import { StandardPageLayout } from "@/components/layouts/standard-page-layout";

export const metadata: Metadata = {
    title: "Our Security · Carmenta",
    description:
        "Carmenta Security - How we protect our data and conversations with industry-leading security practices.",
};

interface SecurityPartner {
    name: string;
    description: string;
    url: string;
    certifications?: string[];
}

const securityPartners: SecurityPartner[] = [
    {
        name: "Clerk",
        description: "Authentication and user management",
        url: "https://clerk.com/security",
        certifications: ["SOC 2 Type II", "GDPR & CCPA", "SAML 2.0"],
    },
    {
        name: "Vercel",
        description: "Infrastructure and hosting",
        url: "https://vercel.com/security",
        certifications: ["SOC 2 Type II", "GDPR Compliant"],
    },
    {
        name: "Sentry",
        description: "Error monitoring without data exposure",
        url: "https://sentry.io/security/",
        certifications: ["SOC 2 Type II", "GDPR", "ISO 27001"],
    },
];

const securityFeatures = [
    {
        icon: Lock,
        title: "Encrypted Storage",
        description:
            "All conversations and data encrypted at rest using industry-standard encryption. Our data is protected even if storage is compromised.",
    },
    {
        icon: Shield,
        title: "End-to-End Encryption",
        description:
            "All data transmission uses HTTPS/TLS 1.3. Our conversations are encrypted from browser to servers and to AI model providers.",
    },
    {
        icon: Eye,
        title: "No Human Access",
        description:
            "Our conversations are private. No human reads our chats unless legally required or explicitly requested for support.",
    },
    {
        icon: KeyRound,
        title: "Secure Authentication",
        description:
            "Industry-standard authentication via Clerk. Multi-factor authentication available. Session tokens encrypted and short-lived.",
    },
    {
        icon: Server,
        title: "Infrastructure Security",
        description:
            "Hosted on Vercel's SOC 2 Type II certified infrastructure with automatic SSL, DDoS protection, and security monitoring.",
    },
    {
        icon: Zap,
        title: "Data Isolation",
        description:
            "Strict data isolation ensures we can only access our own data. Database-level security prevents cross-user data access.",
    },
];

function SecurityBadge({ certification }: { certification: string }) {
    return (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm dark:border-green-800 dark:bg-green-950">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            <span className="font-medium text-green-900 dark:text-green-100">
                {certification}
            </span>
        </div>
    );
}

function PartnerCard({ partner }: { partner: SecurityPartner }) {
    return (
        <a
            href={partner.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-card hover:border-primary/50 relative rounded-xl border p-6 transition-all hover:shadow-lg"
        >
            <div className="mb-4 flex items-start justify-between">
                <div>
                    <h3 className="group-hover:text-primary text-lg font-semibold transition-colors">
                        {partner.name}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {partner.description}
                    </p>
                </div>
                <ExternalLink className="text-muted-foreground group-hover:text-primary h-4 w-4 transition-colors" />
            </div>

            {partner.certifications && partner.certifications.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {partner.certifications.map((cert) => (
                        <SecurityBadge key={cert} certification={cert} />
                    ))}
                </div>
            )}
        </a>
    );
}

export default function SecurityPage() {
    return (
        <StandardPageLayout maxWidth="narrow">
            {/* Hero Section */}
            <section className="relative py-12 sm:py-16 lg:py-20">
                <div className="text-center">
                    <div className="bg-primary/10 mb-4 inline-flex items-center justify-center rounded-2xl p-3">
                        <ShieldCheck className="text-primary h-8 w-8" />
                    </div>

                    <h1 className="text-5xl font-bold tracking-tight">
                        Security First, Always
                    </h1>

                    <p className="text-muted-foreground mx-auto mt-6 max-w-3xl text-xl">
                        Your conversations are precious. We protect them with
                        enterprise-grade security while making AI accessible and
                        powerful.
                    </p>

                    {/* Trust Indicators */}
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Lock className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span>SSL/TLS Encrypted</span>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span>SOC 2 Partners</span>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Eye className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span>Private by Default</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Core Security Promise */}
            <section className="py-16">
                <div className="border-primary/20 bg-primary/5 rounded-2xl border p-8 lg:p-12">
                    <h2 className="mb-6 text-3xl font-bold">Our Security Promise</h2>

                    <div className="grid gap-8 md:grid-cols-2">
                        <div>
                            <h3 className="mb-3 flex items-center gap-2 text-xl font-semibold">
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                What We Protect
                            </h3>
                            <ul className="text-muted-foreground space-y-2">
                                <li>• Our conversations and message history</li>
                                <li>• Files and attachments we share</li>
                                <li>• Authentication credentials</li>
                                <li>• Personal preferences and settings</li>
                                <li>• All data transmission and storage</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="mb-3 flex items-center gap-2 text-xl font-semibold">
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                What We Never Do
                            </h3>
                            <ul className="text-muted-foreground space-y-2">
                                <li>• Sell or share our conversations</li>
                                <li>• Train models on our data without consent</li>
                                <li>• Allow unauthorized human access</li>
                                <li>• Store unencrypted sensitive data</li>
                                <li>• Compromise on security for features</li>
                            </ul>
                        </div>
                    </div>

                    <div className="bg-background/50 mt-8 rounded-lg p-4 backdrop-blur">
                        <p className="text-sm">
                            <strong>How it works:</strong> Our conversations are
                            encrypted in transit and at rest. When we chat with AI
                            models, we route requests securely to the appropriate model
                            provider. Our data stays protected at every step.
                        </p>
                    </div>
                </div>
            </section>

            {/* Security Features Grid */}
            <section className="py-16">
                <div className="mb-12 text-center">
                    <h2 className="text-3xl font-bold">
                        Enterprise-Grade Security Features
                    </h2>
                    <p className="text-muted-foreground mt-4 text-lg">
                        Built on industry-leading security infrastructure
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {securityFeatures.map((feature) => {
                        const Icon = feature.icon;
                        return (
                            <div
                                key={feature.title}
                                className="bg-card rounded-xl border p-6 transition-shadow hover:shadow-md"
                            >
                                <div className="bg-primary/10 mb-4 inline-flex items-center justify-center rounded-lg p-2">
                                    <Icon className="text-primary h-6 w-6" />
                                </div>
                                <h3 className="mb-2 text-lg font-semibold">
                                    {feature.title}
                                </h3>
                                <p className="text-muted-foreground">
                                    {feature.description}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Security Partners */}
            <section className="py-16">
                <div className="mb-12 text-center">
                    <h2 className="text-3xl font-bold">Trusted Security Partners</h2>
                    <p className="text-muted-foreground mt-4 text-lg">
                        We leverage the security certifications of industry leaders
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {securityPartners.map((partner) => (
                        <PartnerCard key={partner.name} partner={partner} />
                    ))}
                </div>

                <div className="bg-muted/50 mt-12 rounded-xl border p-6">
                    <h3 className="mb-3 font-semibold">
                        Compliance & Certifications We Inherit
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        <SecurityBadge certification="SOC 2 Type II" />
                        <SecurityBadge certification="GDPR Compliant" />
                        <SecurityBadge certification="CCPA Compliant" />
                        <SecurityBadge certification="ISO 27001" />
                    </div>
                    <p className="text-muted-foreground mt-4 text-sm">
                        Through our security partners, Carmenta benefits from
                        enterprise-grade compliance and certifications. Your data is
                        protected by the same standards used by Fortune 500 companies.
                    </p>
                </div>
            </section>

            {/* Technical Security Details */}
            <section className="py-16">
                <div className="bg-card rounded-xl border p-8">
                    <h2 className="mb-6 text-2xl font-bold">
                        Technical Security Implementation
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <h3 className="mb-2 font-semibold">Encryption</h3>
                            <ul className="text-muted-foreground list-disc space-y-1 pl-6">
                                <li>TLS 1.3 for all data in transit</li>
                                <li>AES-256 for data at rest</li>
                                <li>Encrypted database connections and backups</li>
                                <li>End-to-end encryption for file uploads</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="mb-2 font-semibold">Access Control</h3>
                            <ul className="text-muted-foreground list-disc space-y-1 pl-6">
                                <li>
                                    Strict user isolation - you can only access your own
                                    data
                                </li>
                                <li>
                                    JWT-based authentication with short-lived tokens
                                </li>
                                <li>Rate limiting on all API endpoints</li>
                                <li>IP-based blocking for suspicious activity</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="mb-2 font-semibold">
                                Monitoring & Response
                            </h3>
                            <ul className="text-muted-foreground list-disc space-y-1 pl-6">
                                <li>Real-time error tracking with Sentry</li>
                                <li>Automated security scanning on all deployments</li>
                                <li>24/7 infrastructure monitoring by Vercel</li>
                                <li>
                                    Immediate session revocation on suspicious activity
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="mb-2 font-semibold">Data Handling</h3>
                            <ul className="text-muted-foreground list-disc space-y-1 pl-6">
                                <li>Encrypted storage of conversations and files</li>
                                <li>
                                    Request logs retained for 90 days (metadata only)
                                </li>
                                <li>Secure deletion on account termination</li>
                                <li>Regular security audits and updates</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Security Practices */}
            <section className="py-16">
                <div className="grid gap-8 lg:grid-cols-2">
                    <div className="rounded-xl border border-green-200 bg-green-50 p-8 dark:border-green-800 dark:bg-green-950">
                        <h3 className="mb-4 text-xl font-bold text-green-900 dark:text-green-100">
                            What We Do
                        </h3>
                        <ul className="space-y-3">
                            {[
                                "Encrypt all data in transit and at rest",
                                "Use industry-standard authentication",
                                "Implement rate limiting and DDoS protection",
                                "Monitor for security threats 24/7",
                                "Regular security audits and updates",
                                "Immediate session revocation on request",
                                "Transparent security practices",
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-2">
                                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                                    <span className="text-green-800 dark:text-green-200">
                                        {item}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-xl border border-red-200 bg-red-50 p-8 dark:border-red-800 dark:bg-red-950">
                        <h3 className="mb-4 text-xl font-bold text-red-900 dark:text-red-100">
                            What We Never Do
                        </h3>
                        <ul className="space-y-3">
                            {[
                                "Store your data unencrypted",
                                "Share or sell your conversations",
                                "Train AI models on your data without consent",
                                "Allow unauthorized human access",
                                "Log sensitive conversation content",
                                "Keep data after account deletion",
                                "Compromise on security for convenience",
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-2">
                                    <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                                    <span className="text-red-800 dark:text-red-200">
                                        {item}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section className="py-16">
                <div className="bg-muted/50 rounded-xl p-8 text-center">
                    <h2 className="mb-4 text-2xl font-bold">Security Questions?</h2>
                    <p className="text-muted-foreground mb-6">
                        We take security seriously. If you have questions about our
                        security practices, found a vulnerability, or need more
                        information for your compliance requirements, please reach out.
                    </p>
                    <div className="flex flex-col justify-center gap-4 sm:flex-row">
                        <a
                            href="mailto:security@carmenta.ai"
                            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 transition-colors"
                        >
                            <Shield className="h-5 w-5" />
                            security@carmenta.ai
                        </a>
                        <a
                            href="/privacy"
                            className="bg-background hover:bg-muted inline-flex items-center justify-center gap-2 rounded-lg border px-6 py-3 transition-colors"
                        >
                            View Privacy Policy
                        </a>
                    </div>
                </div>
            </section>
        </StandardPageLayout>
    );
}
