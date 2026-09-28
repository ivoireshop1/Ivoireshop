"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/src/lib/supabase/browser";

export default function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogout() {
    setIsLoggingOut(true);
    setErrorMessage("");
    const { error } = await createClient().auth.signOut();

    if (error) {
      setIsLoggingOut(false);
      setErrorMessage("We could not log you out. Please try again.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="mt-4">
      <button
        className="min-h-11 rounded-lg border border-forest-green px-4 py-2 text-sm font-medium text-forest-green disabled:opacity-60"
        disabled={isLoggingOut}
        onClick={handleLogout}
        type="button"
      >
        {isLoggingOut ? "Logging out..." : "Sign out"}
      </button>
      {errorMessage && <p className="mt-2 text-sm text-red-700">{errorMessage}</p>}
    </div>
  );
}
