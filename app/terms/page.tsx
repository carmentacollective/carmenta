import { Metadata } from "next";

import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
    title: "Terms of Service",
    description: "Carmenta Terms of Service - Guidelines for our partnership.",
};

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background">
            <SiteHeader bordered />
            {/* Content */}
            <article className="mx-auto max-w-4xl px-6 py-12 sm:px-8 sm:py-16 lg:px-10 lg:py-20">
                <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>

                <div className="prose prose-lg dark:prose-invert mt-8 max-w-none">
                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Agreement to Terms</h2>
                        <p className="mt-4">
                            By accessing or using Carmenta, we agree to be bound by
                            these Terms of Service ("Terms"). If we don't agree to these
                            Terms, we won't use our Service.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Description of Service</h2>
                        <p className="mt-4">
                            Carmenta is a heart-centered AI interface that allows us to:
                        </p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>
                                Access multiple frontier AI models (Claude, ChatGPT,
                                Gemini, etc.) through a unified interface
                            </li>
                            <li>
                                Maintain conversation context across different models
                            </li>
                            <li>
                                Use AI models for various tasks including writing,
                                coding, analysis, and creativity
                            </li>
                            <li>Share files and attachments with AI models</li>
                            <li>Organize and access our conversation history</li>
                        </ul>
                        <p className="mt-4">
                            We route our requests to the most appropriate AI model
                            provider and maintain our conversation history for
                            continuity and context.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Our Account</h2>

                        <h3 className="mt-6 text-xl font-semibold">Account Creation</h3>
                        <p className="mt-2">To use our Service, we must:</p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>
                                Be at least 13 years old (or the age of majority in our
                                jurisdiction)
                            </li>
                            <li>Provide accurate and complete information</li>
                            <li>Keep our account credentials secure</li>
                            <li>
                                Notify Carmenta immediately if we detect unauthorized
                                access
                            </li>
                        </ul>

                        <h3 className="mt-6 text-xl font-semibold">
                            Account Responsibility
                        </h3>
                        <p className="mt-2">We're responsible for:</p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>All activity that occurs under our account</li>
                            <li>
                                Maintaining the confidentiality of our login credentials
                            </li>
                            <li>Ensuring our use complies with these Terms</li>
                            <li>
                                Any costs or damages resulting from our account usage
                            </li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Acceptable Use</h2>
                        <p className="mt-4">We agree NOT to:</p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>Use the Service for any illegal purpose</li>
                            <li>Violate any laws or regulations</li>
                            <li>Infringe on intellectual property rights</li>
                            <li>Abuse, harass, or harm others</li>
                            <li>Transmit malware, viruses, or harmful code</li>
                            <li>Attempt to gain unauthorized access to our systems</li>
                            <li>Interfere with or disrupt the Service</li>
                            <li>
                                Scrape, crawl, or index the Service without permission
                            </li>
                            <li>
                                Resell or redistribute the Service without authorization
                            </li>
                            <li>
                                Use the Service to generate spam or unsolicited
                                communications
                            </li>
                            <li>
                                Reverse engineer or attempt to extract our source code
                            </li>
                            <li>Attempt to bypass rate limits or usage restrictions</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Third-Party AI Services</h2>
                        <p className="mt-4">When we use AI models through Carmenta:</p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>
                                Our requests are processed by third-party AI providers
                                (Anthropic, OpenAI, Google, etc.)
                            </li>
                            <li>
                                We're also agreeing to their terms of service and
                                privacy policies
                            </li>
                            <li>
                                We're not responsible for the accuracy, completeness, or
                                appropriateness of AI-generated content
                            </li>
                            <li>
                                AI model availability depends on third-party service
                                uptime
                            </li>
                            <li>
                                Different models may have different capabilities and
                                limitations
                            </li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">
                            Usage Limits and Fair Use
                        </h2>
                        <p className="mt-4">
                            Our Service includes reasonable usage limits to ensure fair
                            access for all users. We may:
                        </p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>Implement rate limits on API requests</li>
                            <li>Throttle or temporarily restrict excessive usage</li>
                            <li>
                                Charge for usage above free tier limits (when
                                applicable)
                            </li>
                            <li>Change limits with reasonable notice</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Intellectual Property</h2>
                        <p className="mt-4">
                            The Service and its original content, features, and
                            functionality are owned by Carmenta and are protected by
                            international copyright, trademark, patent, trade secret,
                            and other intellectual property laws.
                        </p>
                        <p className="mt-4">
                            We retain ownership of our conversations and content. By
                            using our Service, we grant ourselves a limited license to:
                        </p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>
                                Store and process our conversations to provide the
                                Service
                            </li>
                            <li>
                                Route our requests to appropriate AI model providers
                            </li>
                            <li>Cache responses for performance (temporarily)</li>
                            <li>Use anonymized usage data to improve the Service</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Payment and Billing</h2>
                        <p className="mt-4">If we purchase a paid plan:</p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>We agree to pay all fees for our selected plan</li>
                            <li>Fees are billed in advance on a recurring basis</li>
                            <li>All fees are in USD unless otherwise stated</li>
                            <li>We may change pricing with 30 days notice</li>
                            <li>Refunds are provided on a case-by-case basis</li>
                            <li>We can cancel our subscription at any time</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Service Availability</h2>
                        <p className="mt-4">
                            We strive to provide reliable service, but we don't
                            guarantee:
                        </p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>Uninterrupted or error-free operation</li>
                            <li>That defects will be corrected immediately</li>
                            <li>Availability of third-party AI services</li>
                            <li>
                                That the Service will meet your specific requirements
                            </li>
                            <li>
                                That AI-generated content will be accurate or
                                appropriate
                            </li>
                        </ul>
                        <p className="mt-4">
                            We may suspend or terminate the Service for maintenance,
                            updates, or security reasons with reasonable notice when
                            possible.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Disclaimer of Warranties</h2>
                        <p className="mt-4">
                            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
                            WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING
                            BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS
                            FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
                        </p>
                        <p className="mt-4">
                            WE DO NOT WARRANT THAT AI-GENERATED CONTENT WILL BE
                            ACCURATE, COMPLETE, RELIABLE, OR APPROPRIATE FOR OUR USE. WE
                            ARE RESPONSIBLE FOR VERIFYING AND VALIDATING ALL
                            AI-GENERATED CONTENT.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Limitation of Liability</h2>
                        <p className="mt-4">
                            TO THE FULLEST EXTENT PERMITTED BY LAW, CARMENTA SHALL NOT
                            BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
                            CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS
                            OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY
                            LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
                        </p>
                        <p className="mt-4">
                            Our total liability shall not exceed the amount we paid in
                            the 12 months prior to the event giving rise to liability.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Indemnification</h2>
                        <p className="mt-4">
                            We agree to indemnify and hold harmless Carmenta and its
                            officers, directors, employees, and agents from any claims,
                            damages, losses, liabilities, and expenses (including legal
                            fees) arising from:
                        </p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>Our use of the Service</li>
                            <li>Our violation of these Terms</li>
                            <li>Our violation of any third-party rights</li>
                            <li>Any content we submit or transmit</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Termination</h2>
                        <p className="mt-4">
                            We may terminate or suspend our account and access to the
                            Service:
                        </p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>If we violate these Terms</li>
                            <li>If required by law</li>
                            <li>If our account is inactive for an extended period</li>
                            <li>At our discretion, with or without notice</li>
                        </ul>
                        <p className="mt-4">
                            We can terminate our account at any time through Carmenta.
                            Upon termination:
                        </p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>Our access will cease immediately</li>
                            <li>We'll delete our data per our Privacy Policy</li>
                            <li>We'll lose access to all conversations and settings</li>
                            <li>Certain provisions of these Terms will survive</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Changes to Terms</h2>
                        <p className="mt-4">
                            We reserve the right to modify these Terms at any time.
                            We'll notify ourselves of material changes by:
                        </p>
                        <ul className="mt-2 list-disc space-y-2 pl-6">
                            <li>Posting the updated Terms on this page</li>
                            <li>Updating the "Last updated" date</li>
                            <li>Sending an email notification</li>
                        </ul>
                        <p className="mt-4">
                            Our continued use of the Service after changes constitutes
                            acceptance of the new Terms.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Governing Law</h2>
                        <p className="mt-4">
                            These Terms shall be governed by and construed in accordance
                            with the laws of the State of California, United States,
                            without regard to its conflict of law provisions.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Dispute Resolution</h2>
                        <p className="mt-4">
                            If we have a dispute, we'll first contact ourselves at{" "}
                            <a
                                href="mailto:care@carmenta.ai"
                                className="text-primary hover:underline"
                            >
                                care@carmenta.ai
                            </a>{" "}
                            to try to resolve it informally. We'll work in good faith to
                            resolve any issues.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Miscellaneous</h2>
                        <ul className="mt-4 list-disc space-y-2 pl-6">
                            <li>
                                <strong>Entire Agreement:</strong> These Terms
                                constitute the entire agreement within Carmenta.
                            </li>
                            <li>
                                <strong>Severability:</strong> If any provision is found
                                unenforceable, the rest remains in effect.
                            </li>
                            <li>
                                <strong>Waiver:</strong> Our failure to enforce any
                                right doesn't waive that right.
                            </li>
                            <li>
                                <strong>Assignment:</strong> We may not assign these
                                Terms without our written consent.
                            </li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h2 className="text-2xl font-bold">Contact Us</h2>
                        <p className="mt-4">Questions about these Terms? Contact us:</p>
                        <ul className="mt-2 space-y-2">
                            <li>
                                Email:{" "}
                                <a
                                    href="mailto:care@carmenta.ai"
                                    className="text-primary hover:underline"
                                >
                                    care@carmenta.ai
                                </a>
                            </li>
                            <li>
                                Website:{" "}
                                <a
                                    href="https://carmenta.ai"
                                    className="text-primary hover:underline"
                                >
                                    https://carmenta.ai
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
