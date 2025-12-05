import type { Appearance } from "@clerk/types";

/**
 * Holographic Dream Theme for Clerk Components
 *
 * Unified appearance configuration that makes all Clerk components
 * feel like native Carmenta UI. Applied globally at ClerkProvider.
 *
 * Design principles:
 * - Glassmorphism with backdrop blur
 * - Holographic gradient accents (lavender → cyan → pink)
 * - Soft shadows with purple tints
 * - Warm but substantive typography
 */
export const clerkAppearance: Appearance = {
    variables: {
        // Typography
        fontFamily: "var(--font-outfit), system-ui, sans-serif",
        fontFamilyButtons: "var(--font-outfit), system-ui, sans-serif",
        fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },

        // Colors - Holographic palette
        colorPrimary: "hsl(280 40% 75%)", // Lavender primary
        colorText: "hsl(285 25% 31%)", // Deep purple-gray
        colorTextSecondary: "hsl(285 20% 50%)", // Muted purple
        colorBackground: "hsl(320 20% 97%)", // Soft lavender-white
        colorInputBackground: "rgba(255, 255, 255, 0.5)",
        colorInputText: "hsl(285 25% 31%)",

        // Borders & Shadows
        borderRadius: "0.75rem",
        colorDanger: "hsl(0 60% 70%)",
        colorSuccess: "hsl(160 50% 50%)",
        colorWarning: "hsl(40 80% 60%)",

        // Spacing
        spacingUnit: "1rem",
    },

    elements: {
        // ═══════════════════════════════════════════════════════════════════
        // ROOT & CARD CONTAINERS
        // ═══════════════════════════════════════════════════════════════════
        rootBox: "font-sans",
        card: [
            "rounded-2xl p-6",
            "bg-white/60 backdrop-blur-[24px]",
            "shadow-[0_8px_32px_rgba(180,140,200,0.2),0_0_0_1px_rgba(255,255,255,0.6),inset_0_1px_0_rgba(255,255,255,0.8)]",
            "border-0",
        ].join(" "),
        cardBox: "shadow-none",

        // ═══════════════════════════════════════════════════════════════════
        // HEADERS
        // ═══════════════════════════════════════════════════════════════════
        headerTitle: "text-foreground font-semibold tracking-tight",
        headerSubtitle: "text-muted-foreground",
        headerBackRow: "text-foreground",
        headerBackLink: "text-primary hover:text-primary/80",
        headerBackIcon: "text-primary",

        // ═══════════════════════════════════════════════════════════════════
        // SOCIAL LOGIN BUTTONS
        // ═══════════════════════════════════════════════════════════════════
        socialButtonsBlockButton: [
            "bg-white/50 backdrop-blur-sm",
            "text-foreground font-medium",
            "border border-foreground/10",
            "hover:bg-white/80 hover:border-foreground/20",
            "transition-all duration-200",
        ].join(" "),
        socialButtonsBlockButtonText: "text-foreground font-medium",
        socialButtonsBlockButtonArrow: "text-foreground/50",
        socialButtonsProviderIcon: "opacity-90",

        // ═══════════════════════════════════════════════════════════════════
        // DIVIDERS
        // ═══════════════════════════════════════════════════════════════════
        dividerLine: "bg-foreground/10",
        dividerText: "text-muted-foreground text-sm",

        // ═══════════════════════════════════════════════════════════════════
        // FORM FIELDS
        // ═══════════════════════════════════════════════════════════════════
        formFieldLabel: "text-foreground font-medium text-sm mb-1.5",
        formFieldLabelRow: "mb-1.5",
        formFieldInput: [
            "bg-white/50 backdrop-blur-sm",
            "border border-foreground/10",
            "text-foreground placeholder:text-muted-foreground/60",
            "focus:ring-2 focus:ring-primary/30 focus:border-primary/40",
            "transition-all duration-200",
            "rounded-xl px-4 py-3",
        ].join(" "),
        formFieldInputShowPasswordButton: "text-muted-foreground hover:text-foreground",
        formFieldErrorText: "text-destructive text-sm mt-1",
        formFieldSuccessText: "text-green-600 text-sm mt-1",
        formFieldInfoText: "text-muted-foreground text-sm mt-1",
        formFieldHintText: "text-muted-foreground text-xs",
        formFieldAction: "text-primary hover:text-primary/80 text-sm font-medium",

        // ═══════════════════════════════════════════════════════════════════
        // PRIMARY BUTTONS (Sign in, Continue, etc.)
        // ═══════════════════════════════════════════════════════════════════
        formButtonPrimary: [
            "relative inline-flex items-center justify-center",
            "rounded-full px-6 py-3",
            "text-sm font-medium text-white",
            "bg-gradient-to-r from-[rgba(200,160,220,0.9)] via-[rgba(160,200,220,0.9)] to-[rgba(220,180,200,0.9)]",
            "shadow-[0_4px_16px_rgba(180,140,200,0.3)]",
            "hover:scale-105 hover:shadow-[0_8px_24px_rgba(180,140,200,0.4)]",
            "active:scale-100",
            "transition-all duration-200",
            "border-0",
        ].join(" "),
        formButtonReset: "text-muted-foreground hover:text-foreground text-sm",

        // ═══════════════════════════════════════════════════════════════════
        // FOOTER LINKS
        // ═══════════════════════════════════════════════════════════════════
        footerAction: "mt-6",
        footerActionText: "text-muted-foreground text-sm",
        footerActionLink: "text-primary hover:text-primary/80 font-medium",

        // ═══════════════════════════════════════════════════════════════════
        // USER BUTTON - THE POPUP MENU
        // ═══════════════════════════════════════════════════════════════════
        userButtonTrigger: "focus:ring-2 focus:ring-primary/30 rounded-full",
        userButtonBox: "rounded-full",
        avatarBox: "h-12 w-12 rounded-full",
        avatarImage: "rounded-full",

        // The popover card (dropdown container)
        userButtonPopoverCard: [
            "rounded-2xl p-2",
            "bg-white/90 backdrop-blur-xl",
            "border border-white/60",
            "shadow-[0_8px_32px_rgba(180,140,200,0.25),0_0_0_1px_rgba(255,255,255,0.5)]",
        ].join(" "),
        userButtonPopoverMain: "p-1",
        userButtonPopoverActions: "p-1",

        // User preview section at top of popover
        userPreview: "px-3 py-2",
        userPreviewAvatarBox: "h-10 w-10",
        userPreviewMainIdentifier: "text-foreground font-medium",
        userPreviewSecondaryIdentifier: "text-muted-foreground text-sm",

        // Action buttons in popover
        userButtonPopoverActionButton: [
            "rounded-xl px-3 py-2",
            "text-foreground",
            "hover:bg-white/60",
            "transition-colors duration-150",
            "w-full justify-start",
        ].join(" "),
        userButtonPopoverActionButtonIcon: "text-foreground/60 mr-3 h-4 w-4",
        userButtonPopoverActionButtonText: "text-foreground text-sm font-medium",

        // Hide Clerk branding
        userButtonPopoverFooter: "hidden",

        // ═══════════════════════════════════════════════════════════════════
        // USER PROFILE MODAL (Manage Account)
        // ═══════════════════════════════════════════════════════════════════
        modalBackdrop: "bg-background/60 backdrop-blur-sm",
        modalContent: [
            "rounded-2xl",
            "bg-white/95 backdrop-blur-xl",
            "border border-white/60",
            "shadow-[0_24px_64px_rgba(180,140,200,0.3)]",
        ].join(" "),
        modalCloseButton:
            "text-foreground/50 hover:text-foreground hover:bg-foreground/5 rounded-full",

        // Profile page content
        profilePage: "p-0",
        profileSection: "border-b border-foreground/5 last:border-0",
        profileSectionTitle: "text-foreground font-semibold text-lg px-6 py-4",
        profileSectionTitleText: "text-foreground font-semibold",
        profileSectionSubtitle: "text-muted-foreground text-sm",
        profileSectionContent: "px-6 pb-6",
        profileSectionPrimaryButton: [
            "rounded-xl px-4 py-2",
            "text-sm font-medium",
            "bg-primary/10 text-primary",
            "hover:bg-primary/20",
            "transition-colors duration-200",
        ].join(" "),

        // Navbar in profile modal
        navbar: "border-r border-foreground/5 bg-foreground/[0.02]",
        navbarButton: [
            "rounded-xl mx-2 px-3 py-2",
            "text-foreground/70",
            "hover:bg-foreground/5 hover:text-foreground",
            "transition-colors duration-150",
        ].join(" "),
        navbarButtonIcon: "text-foreground/50",

        // Page scroll container
        scrollBox:
            "scrollbar-thin scrollbar-thumb-foreground/10 scrollbar-track-transparent",

        // ═══════════════════════════════════════════════════════════════════
        // FORM ELEMENTS IN PROFILE
        // ═══════════════════════════════════════════════════════════════════
        formContainer: "space-y-4",
        form: "space-y-4",
        formHeader: "mb-4",
        formHeaderTitle: "text-foreground font-semibold text-lg",
        formHeaderSubtitle: "text-muted-foreground text-sm mt-1",
        formResendCodeLink: "text-primary hover:text-primary/80 text-sm font-medium",

        // OTP Input
        otpCodeFieldInputs: "gap-2",
        otpCodeFieldInput: [
            "w-12 h-12",
            "bg-white/50 backdrop-blur-sm",
            "border border-foreground/10",
            "text-foreground text-center text-lg font-medium",
            "focus:ring-2 focus:ring-primary/30 focus:border-primary/40",
            "rounded-xl",
        ].join(" "),

        // Select/Dropdown
        selectButton: [
            "bg-white/50 backdrop-blur-sm",
            "border border-foreground/10",
            "text-foreground",
            "rounded-xl px-4 py-3",
            "hover:bg-white/70",
            "focus:ring-2 focus:ring-primary/30",
        ].join(" "),
        selectOptionsContainer: [
            "bg-white/95 backdrop-blur-xl",
            "border border-white/60",
            "rounded-xl shadow-lg",
        ].join(" "),
        selectOption: "text-foreground hover:bg-foreground/5 px-4 py-2 rounded-lg",

        // Phone input
        phoneInputBox: [
            "bg-white/50 backdrop-blur-sm",
            "border border-foreground/10",
            "rounded-xl",
            "focus-within:ring-2 focus-within:ring-primary/30",
        ].join(" "),

        // ═══════════════════════════════════════════════════════════════════
        // ALERTS & BADGES
        // ═══════════════════════════════════════════════════════════════════
        alert: "rounded-xl px-4 py-3 border",
        alertText: "text-sm",
        badge: "rounded-full px-2 py-0.5 text-xs font-medium",
        badgePrimary: "bg-primary/10 text-primary",
        badgeSecondary: "bg-foreground/5 text-muted-foreground",

        // ═══════════════════════════════════════════════════════════════════
        // IDENTITY PREVIEW (showing current email/user)
        // ═══════════════════════════════════════════════════════════════════
        identityPreview: [
            "rounded-xl p-3",
            "bg-foreground/[0.02] border border-foreground/5",
        ].join(" "),
        identityPreviewText: "text-foreground font-medium",
        identityPreviewEditButton: "text-primary hover:text-primary/80",

        // ═══════════════════════════════════════════════════════════════════
        // MENU LISTS (in various contexts)
        // ═══════════════════════════════════════════════════════════════════
        menuList: "p-1",
        menuItem: [
            "rounded-xl px-3 py-2",
            "text-foreground",
            "hover:bg-foreground/5",
            "transition-colors duration-150",
        ].join(" "),
        menuButton: [
            "rounded-xl px-3 py-2",
            "text-foreground",
            "hover:bg-foreground/5",
            "transition-colors duration-150",
        ].join(" "),

        // ═══════════════════════════════════════════════════════════════════
        // BUTTONS (General)
        // ═══════════════════════════════════════════════════════════════════
        button: "rounded-xl px-4 py-2 font-medium transition-colors duration-200",

        // Active sessions / device list
        activeDeviceIcon: "text-primary",
        activeDevice: "rounded-xl p-3 bg-foreground/[0.02] border border-foreground/5",
    },
};

/**
 * Dark mode overrides - applied via CSS custom properties
 * These selectors use Tailwind's dark: prefix for automatic switching
 */
export const clerkDarkModeElements = {
    card: [
        "dark:bg-[rgba(40,30,50,0.6)]",
        "dark:shadow-[0_8px_32px_rgba(100,80,120,0.3),0_0_0_1px_rgba(255,255,255,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]",
    ].join(" "),
    userButtonPopoverCard: [
        "dark:bg-[rgba(40,30,50,0.9)]",
        "dark:border-white/10",
    ].join(" "),
    modalContent: ["dark:bg-[rgba(40,30,50,0.95)]", "dark:border-white/10"].join(" "),
};
