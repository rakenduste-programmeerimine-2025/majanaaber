import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function LandingCTA() {
  return (
    <div className="w-full py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8 md:p-12">
          <div className="relative z-10 flex flex-col items-center text-center gap-6">
            <h2 className="text-3xl md:text-4xl font-bold max-w-2xl">
              Ready to transform your building management?
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl">
              Join managers and residents who are already experiencing better communication and streamlined operations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-2">
              <Button asChild size="lg" className="text-lg px-8">
                <Link href="/auth/sign-up" className="flex items-center gap-2">
                  Create Account
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-8">
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              No credit card required. Get started in minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
