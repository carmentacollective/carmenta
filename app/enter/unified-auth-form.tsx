"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";

import { logger } from "@/lib/client-logger";

const EMAIL_STORAGE_KEY = "carmenta_remembered_email";

type AuthStep = "email" | "password" | "signup" | "verify";

/**
 * Unified authentication form with email-first flow
 *
 * Flow:
 * 1. User enters email (persisted in localStorage)
 * 2. We detect if user exists via Clerk API
 * 3. Returning user → password field
 * 4. New user → name + password fields
 * 5. Both → verification if required
 */
export function UnifiedAuthForm() {
    const router = useRouter();
    const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
    const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();

    const [step, setStep] = useState<AuthStep>("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const passwordInputRef = useRef<HTMLInputElement>(null);
    const emailInputRef = useRef<HTMLInputElement>(null);

    // Load remembered email on mount
    useEffect(() => {
        const remembered = localStorage.getItem(EMAIL_STORAGE_KEY);
        if (remembered) {
            setEmail(remembered);
        }
    }, []);

    // Save email to localStorage when it changes
    const saveEmail = useCallback((value: string) => {
        setEmail(value);
        if (value) {
            localStorage.setItem(EMAIL_STORAGE_KEY, value);
        }
    }, []);

    // Check if email exists and determine flow
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signInLoaded || !email) return;

        setIsLoading(true);
        setError("");

        try {
            // Try to start sign-in flow - this will tell us if user exists
            const result = await signIn.create({
                identifier: email,
            });

            // User exists - show password field
            if (result.status === "needs_first_factor") {
                setStep("password");
                // Focus password field after render
                setTimeout(() => passwordInputRef.current?.focus(), 50);
            }
        } catch (err: unknown) {
            const clerkError = err as {
                errors?: Array<{ code: string; message: string }>;
            };

            // Check if user doesn't exist
            const notFound = clerkError.errors?.some(
                (e) =>
                    e.code === "form_identifier_not_found" ||
                    e.code === "identifier_not_found"
            );

            if (notFound) {
                // New user - show signup form
                setStep("signup");
            } else {
                // Other error
                const message =
                    clerkError.errors?.[0]?.message || "Something went wrong";
                setError(message);
                logger.error({ error: err, email }, "Email check failed");
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Handle sign-in with password
    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signInLoaded || !signIn) return;

        setIsLoading(true);
        setError("");

        try {
            const result = await signIn.attemptFirstFactor({
                strategy: "password",
                password,
            });

            if (result.status === "complete") {
                await setSignInActive({ session: result.createdSessionId });
                router.push("/connection");
            } else if (result.status === "needs_second_factor") {
                // Handle 2FA if needed
                setStep("verify");
            }
        } catch (err: unknown) {
            const clerkError = err as { errors?: Array<{ message: string }> };
            const message = clerkError.errors?.[0]?.message || "Incorrect password";
            setError(message);
            logger.error({ error: err }, "Sign-in failed");
        } finally {
            setIsLoading(false);
        }
    };

    // Handle sign-up
    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signUpLoaded || !signUp) return;

        setIsLoading(true);
        setError("");

        try {
            const result = await signUp.create({
                emailAddress: email,
                password,
                firstName: firstName || undefined,
                lastName: lastName || undefined,
            });

            if (result.status === "complete") {
                await setSignUpActive({ session: result.createdSessionId });
                router.push("/connection");
            } else if (
                result.status === "missing_requirements" &&
                result.unverifiedFields.includes("email_address")
            ) {
                // Need email verification
                await signUp.prepareEmailAddressVerification({
                    strategy: "email_code",
                });
                setStep("verify");
            }
        } catch (err: unknown) {
            const clerkError = err as { errors?: Array<{ message: string }> };
            const message =
                clerkError.errors?.[0]?.message || "Could not create account";
            setError(message);
            logger.error({ error: err }, "Sign-up failed");
        } finally {
            setIsLoading(false);
        }
    };

    // Handle verification code
    const handleVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signUpLoaded || !signUp) return;

        setIsLoading(true);
        setError("");

        try {
            const result = await signUp.attemptEmailAddressVerification({
                code: verificationCode,
            });

            if (result.status === "complete") {
                await setSignUpActive({ session: result.createdSessionId });
                router.push("/connection");
            }
        } catch (err: unknown) {
            const clerkError = err as { errors?: Array<{ message: string }> };
            const message = clerkError.errors?.[0]?.message || "Invalid code";
            setError(message);
            logger.error({ error: err }, "Verification failed");
        } finally {
            setIsLoading(false);
        }
    };

    // Toggle password visibility while keeping focus
    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
        // Maintain focus on password field
        setTimeout(() => passwordInputRef.current?.focus(), 0);
    };

    // Go back to email step
    const handleBack = () => {
        setStep("email");
        setPassword("");
        setError("");
        setTimeout(() => emailInputRef.current?.focus(), 50);
    };

    // Render heading based on step
    const renderHeading = () => {
        switch (step) {
            case "email":
                return (
                    <>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground/90">
                            Enter Carmenta
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            We remember you
                        </p>
                    </>
                );
            case "password":
                return (
                    <>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground/90">
                            Welcome back
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Pick up where we left off
                        </p>
                    </>
                );
            case "signup":
                return (
                    <>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground/90">
                            Let&apos;s get started
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Create your account
                        </p>
                    </>
                );
            case "verify":
                return (
                    <>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground/90">
                            Check your email
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            We sent a code to {email}
                        </p>
                    </>
                );
        }
    };

    if (!signInLoaded || !signUpLoaded) {
        return (
            <div className="flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm">
            {/* Logo and heading */}
            <div className="mb-8 flex flex-col items-center text-center">
                <Image
                    src="/logos/icon-transparent.png"
                    alt="Carmenta"
                    width={64}
                    height={64}
                    className="mb-4 h-16 w-16"
                    priority
                />
                {renderHeading()}
            </div>

            {/* Form card */}
            <div className="rounded-2xl bg-white/60 p-6 shadow-[0_8px_32px_rgba(180,140,200,0.2),0_0_0_1px_rgba(255,255,255,0.6),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-[24px]">
                {/* Email step */}
                {step === "email" && (
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-1.5 block text-sm font-medium text-foreground"
                            >
                                Email
                            </label>
                            <input
                                ref={emailInputRef}
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => saveEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                                autoFocus
                                required
                                className="w-full rounded-xl border border-foreground/10 bg-white/50 px-4 py-3 text-foreground backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <button
                            type="submit"
                            disabled={isLoading || !email}
                            className="relative inline-flex w-full items-center justify-center rounded-full border-0 bg-gradient-to-r from-[rgba(200,160,220,0.9)] via-[rgba(160,200,220,0.9)] to-[rgba(220,180,200,0.9)] px-6 py-3 text-sm font-medium text-white shadow-[0_4px_16px_rgba(180,140,200,0.3)] transition-all duration-200 hover:scale-105 hover:shadow-[0_8px_24px_rgba(180,140,200,0.4)] active:scale-100 disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {isLoading ? "Checking..." : "Continue"}
                        </button>
                    </form>
                )}

                {/* Password step (sign-in) */}
                {step === "password" && (
                    <form onSubmit={handleSignIn} className="space-y-4">
                        {/* Show email with edit option */}
                        <div className="rounded-xl border border-foreground/5 bg-foreground/[0.02] p-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground">
                                    {email}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="text-sm font-medium text-primary hover:text-primary/80"
                                >
                                    Change
                                </button>
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-1.5 block text-sm font-medium text-foreground"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    ref={passwordInputRef}
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    autoFocus
                                    required
                                    className="w-full rounded-xl border border-foreground/10 bg-white/50 px-4 py-3 pr-12 text-foreground backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <button
                                    type="button"
                                    onClick={togglePasswordVisibility}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <EyeOffIcon className="h-5 w-5" />
                                    ) : (
                                        <EyeIcon className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <button
                            type="submit"
                            disabled={isLoading || !password}
                            className="relative inline-flex w-full items-center justify-center rounded-full border-0 bg-gradient-to-r from-[rgba(200,160,220,0.9)] via-[rgba(160,200,220,0.9)] to-[rgba(220,180,200,0.9)] px-6 py-3 text-sm font-medium text-white shadow-[0_4px_16px_rgba(180,140,200,0.3)] transition-all duration-200 hover:scale-105 hover:shadow-[0_8px_24px_rgba(180,140,200,0.4)] active:scale-100 disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {isLoading ? "Signing in..." : "Continue"}
                        </button>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    // TODO: Implement forgot password
                                }}
                                className="text-sm font-medium text-primary hover:text-primary/80"
                            >
                                Forgot password?
                            </button>
                        </div>
                    </form>
                )}

                {/* Signup step */}
                {step === "signup" && (
                    <form onSubmit={handleSignUp} className="space-y-4">
                        {/* Show email with edit option */}
                        <div className="rounded-xl border border-foreground/5 bg-foreground/[0.02] p-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground">
                                    {email}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="text-sm font-medium text-primary hover:text-primary/80"
                                >
                                    Change
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label
                                    htmlFor="firstName"
                                    className="mb-1.5 block text-sm font-medium text-foreground"
                                >
                                    First name
                                </label>
                                <input
                                    id="firstName"
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    autoComplete="given-name"
                                    autoFocus
                                    className="w-full rounded-xl border border-foreground/10 bg-white/50 px-4 py-3 text-foreground backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="lastName"
                                    className="mb-1.5 block text-sm font-medium text-foreground"
                                >
                                    Last name
                                </label>
                                <input
                                    id="lastName"
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    autoComplete="family-name"
                                    className="w-full rounded-xl border border-foreground/10 bg-white/50 px-4 py-3 text-foreground backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="signupPassword"
                                className="mb-1.5 block text-sm font-medium text-foreground"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    ref={passwordInputRef}
                                    id="signupPassword"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                    className="w-full rounded-xl border border-foreground/10 bg-white/50 px-4 py-3 pr-12 text-foreground backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <button
                                    type="button"
                                    onClick={togglePasswordVisibility}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <EyeOffIcon className="h-5 w-5" />
                                    ) : (
                                        <EyeIcon className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <button
                            type="submit"
                            disabled={isLoading || !password}
                            className="relative inline-flex w-full items-center justify-center rounded-full border-0 bg-gradient-to-r from-[rgba(200,160,220,0.9)] via-[rgba(160,200,220,0.9)] to-[rgba(220,180,200,0.9)] px-6 py-3 text-sm font-medium text-white shadow-[0_4px_16px_rgba(180,140,200,0.3)] transition-all duration-200 hover:scale-105 hover:shadow-[0_8px_24px_rgba(180,140,200,0.4)] active:scale-100 disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {isLoading ? "Creating account..." : "Create account"}
                        </button>
                    </form>
                )}

                {/* Verification step */}
                {step === "verify" && (
                    <form onSubmit={handleVerification} className="space-y-4">
                        <div>
                            <label
                                htmlFor="code"
                                className="mb-1.5 block text-sm font-medium text-foreground"
                            >
                                Verification code
                            </label>
                            <input
                                id="code"
                                type="text"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                placeholder="Enter code"
                                autoComplete="one-time-code"
                                autoFocus
                                required
                                className="w-full rounded-xl border border-foreground/10 bg-white/50 px-4 py-3 text-center text-lg tracking-widest text-foreground backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <button
                            type="submit"
                            disabled={isLoading || !verificationCode}
                            className="relative inline-flex w-full items-center justify-center rounded-full border-0 bg-gradient-to-r from-[rgba(200,160,220,0.9)] via-[rgba(160,200,220,0.9)] to-[rgba(220,180,200,0.9)] px-6 py-3 text-sm font-medium text-white shadow-[0_4px_16px_rgba(180,140,200,0.3)] transition-all duration-200 hover:scale-105 hover:shadow-[0_8px_24px_rgba(180,140,200,0.4)] active:scale-100 disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {isLoading ? "Verifying..." : "Verify"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

// Simple icon components
function EyeIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function EyeOffIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    );
}
