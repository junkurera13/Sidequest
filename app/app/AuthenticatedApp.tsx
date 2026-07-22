"use client";

import { RedirectToSignIn } from "@clerk/nextjs";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import AccountGate from "./AccountGate";
import SidequestApp from "./SidequestApp";
import type { SidequestTabIndex } from "./BottomNavigation";
import styles from "./page.module.css";

export default function AuthenticatedApp({
  initialTab,
}: {
  initialTab: SidequestTabIndex;
}) {
  return (
    <>
      <AuthLoading>
        <main className={styles.accountState} aria-label="Opening Sidequest">
          <span className={styles.accountPulse} aria-hidden="true" />
        </main>
      </AuthLoading>
      <Authenticated>
        <AccountGate>
          <SidequestApp initialTab={initialTab} />
        </AccountGate>
      </Authenticated>
      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
    </>
  );
}
