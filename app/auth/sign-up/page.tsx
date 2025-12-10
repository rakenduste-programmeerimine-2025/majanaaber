import { SignUpForm } from "@/components/sign-up-form";
import Link from "next/link";

export default function Page() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-6 md:p-10">
      
      {/* Minimal header */}
      <header className="w-full max-w-sm mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm px-3 py-1 border rounded hover:bg-muted"
        >
          ← Back to Main Page
        </Link>
      </header>
      <div className="w-full max-w-sm">
        <SignUpForm />
      </div>
    </div>
  );
}
