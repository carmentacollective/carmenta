import { redirect } from "next/navigation";

/**
 * Legacy sign-up route - redirects to unified /enter page
 */
export default function SignUpPage() {
    redirect("/enter");
}
