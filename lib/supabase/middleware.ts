import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip middleware check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (
    request.nextUrl.pathname !== "/" &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, deactivated_at")
      .eq("id", user.sub)
      .single();

    const userRole = profile?.role;
    const pathname = request.nextUrl.pathname;
    const isDeactivated = profile && profile.deactivated_at !== null;

    // Redirect logged-in users away from auth pages and landing page
    if (pathname === "/" || pathname.startsWith("/auth/login") || pathname.startsWith("/auth/sign-up")) {
      const url = request.nextUrl.clone();
      // Redirect based on user role
      if (userRole === "building_manager") {
        url.pathname = "/manager";
      } else {
        url.pathname = "/resident";
      }
      return NextResponse.redirect(url);
    }

    if (isDeactivated && !pathname.startsWith("/auth")) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("deactivated", "true");
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/admin") && userRole !== "building_manager") {
      const url = request.nextUrl.clone();
      url.pathname = "/resident";
      return NextResponse.redirect(url);
    }

    if (
      pathname.startsWith("/manager") &&
      userRole !== "building_manager"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/resident";
      return NextResponse.redirect(url);
    }

    if (
      pathname.startsWith("/resident") &&
      (userRole === "building_manager")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/manager";
      return NextResponse.redirect(url);
    }

    // Protect /management routes - check if resident is also a manager
    if (
      pathname.startsWith("/management") &&
      userRole !== "building_manager"
    ) {
      // Check if the resident is also a building manager
      const { data: managerRecord } = await supabase
        .from("buildings")
        .select("id")
        .eq("manager_id", user.sub)
        .limit(1)
        .single();

      // Only redirect if they don't manage any buildings
      if (!managerRecord) {
        const url = request.nextUrl.clone();
        url.pathname = "/resident";
        return NextResponse.redirect(url);
      }
    }

    // Protect /residence routes - check if building manager is also a resident
    if (
      pathname.startsWith("/residence") &&
      userRole === "building_manager"
    ) {
      // Check if the building manager is also a resident somewhere
      const { data: residentRecord } = await supabase
        .from("building_residents")
        .select("id")
        .eq("profile_id", user.sub)
        .eq("is_approved", true)
        .limit(1)
        .single();

      // Only redirect if they're not a resident anywhere
      if (!residentRecord) {
        const url = request.nextUrl.clone();
        url.pathname = "/manager";
        return NextResponse.redirect(url);
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
