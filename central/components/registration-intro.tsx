"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

export function RegistrationIntro({ children }: { children: ReactNode }) {
  const [finished, setFinished] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);

  useEffect(() => {
    if (!logoLoaded) return;
    // Keep the complete introduction visible even when motion is reduced.
    const timer = window.setTimeout(() => setFinished(true), 3000);
    return () => window.clearTimeout(timer);
  }, [logoLoaded]);

  if (finished) return <div className="registration-reveal">{children}</div>;

  return (
    <main className="registration-shell flex min-h-dvh items-center justify-center px-8" aria-label="Speed GT Brasil">
      <Image
        src="/central/brand/speed-gt-brasil.png"
        alt="Speed GT Brasil"
        width={320}
        height={320}
        priority
        unoptimized
        className={`${logoLoaded ? "registration-logo-intro" : "opacity-0"} h-auto w-56 max-w-full object-contain sm:w-72`}
        onLoad={() => setLogoLoaded(true)}
        onError={() => setFinished(true)}
      />
    </main>
  );
}
