import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return <SignInForm emailDomain={process.env.NEXT_PUBLIC_MEMBER_EMAIL_DOMAIN || "members.twosix.invalid"} />;
}
