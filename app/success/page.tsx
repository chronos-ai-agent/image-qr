"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const type = searchParams.get("type");
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    if (sessionId && type === "lifetime") {
      const localSessionId = localStorage.getItem("session_id");
      if (localSessionId) {
        fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: localSessionId, type }),
        })
          .then(() => setUpdated(true))
          .catch(console.error);
      }
    }
  }, [sessionId, type]);

  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>

        {type === "lifetime" ? (
          <p className="text-muted-foreground mb-6">
            You now have unlimited access to download all QR codes without
            watermarks, forever!
          </p>
        ) : (
          <p className="text-muted-foreground mb-6">
            Your QR code download is ready. Thank you for your purchase!
          </p>
        )}

        <Button asChild size="lg">
          <Link href="/">
            {type === "lifetime" ? "Start Creating" : "Download Your QR"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center">
      <div className="container mx-auto px-4 max-w-lg">
        <Suspense fallback={<div className="text-center">Loading...</div>}>
          <SuccessContent />
        </Suspense>
      </div>
    </main>
  );
}
