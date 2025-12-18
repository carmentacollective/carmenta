import { redirect } from "next/navigation";

/**
 * Legacy sign-in route - redirects to unified /enter page
 */
export default function SignInPage() {
    redirect("/enter");
}
