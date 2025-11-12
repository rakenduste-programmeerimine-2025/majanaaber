import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2, MessageSquare, FileText } from "lucide-react";

export function LandingHero() {
  return (
    <div className="flex flex-col gap-8 items-center text-center px-4">
      <div className="flex items-center gap-2 text-primary">
        <Building2 className="w-12 h-12" />
        <h1 className="text-5xl lg:text-6xl font-bold">MajaNaaber</h1>
      </div>

      <p className="text-2xl lg:text-3xl !leading-tight mx-auto max-w-3xl text-muted-foreground">
        The modern platform connecting{" "}
        <span className="text-foreground font-semibold">building managers</span> and{" "}
        <span className="text-foreground font-semibold">residents</span>
      </p>

      <p className="text-lg lg:text-xl mx-auto max-w-2xl text-muted-foreground">
        Simplify building management, streamline communication, and enhance resident experience—all in one place.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 mt-4">
        <Button asChild size="lg" className="text-lg px-8">
          <Link href="/auth/sign-up">Get Started</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="text-lg px-8">
          <Link href="/auth/login">Sign In</Link>
        </Button>
      </div>

      <div className="flex flex-wrap justify-center gap-8 mt-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <span>Real-time Communication</span>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          <span>Invoice Management</span>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          <span>Building Organization</span>
        </div>
      </div>

      <div className="w-full p-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent mt-12" />
    </div>
  );
}
