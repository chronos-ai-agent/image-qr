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
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handlePostPayment = async () => {
      const localSessionId = localStorage.getItem("session_id");
      
      // Update user status for lifetime purchases
      if (sessionId && type === "lifetime" && localSessionId) {
        try {
          await fetch("/api/user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: localSessionId, type }),
          });
          setUpdated(true);
        } catch (e) {
          console.error("Failed to update user status:", e);
        }
      }

      // Check for pending generation
      const pendingStr = localStorage.getItem("pending_generation");
      if (pendingStr) {
        try {
          const pending = JSON.parse(pendingStr);
          localStorage.removeItem("pending_generation");
          
          setGenerating(true);
          
          // Simulate progress
          const progressInterval = setInterval(() => {
            setProgress((p) => Math.min(p + Math.random() * 15, 90));
          }, 500);

          const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: pending.url,
              imageDescription: pending.imageDescription,
              imageUrl: pending.imageUrl,
              sessionId: localSessionId,
            }),
          });

          clearInterval(progressInterval);
          setProgress(100);

          const data = await response.json();
          
          if (data.error) {
            throw new Error(data.error);
          }

          setGeneratedImage(data.imageUrl);
        } catch (e) {
          console.error("Generation failed:", e);
          setError(e instanceof Error ? e.message : "Generation failed");
        } finally {
          setGenerating(false);
        }
      }
    };

    handlePostPayment();
  }, [sessionId, type]);

  const handleDownload = () => {
    if (!generatedImage) return;
    
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `qr-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Show generating state
  if (generating) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="animate-spin h-8 w-8 text-primary"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Creating Your QR Code...</h1>
          <p className="text-muted-foreground mb-4">
            Our AI is generating your artistic QR code. This may take a moment.
          </p>
          <div className="w-full bg-secondary rounded-full h-2 mb-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{Math.round(progress)}%</p>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Generation Failed</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button asChild size="lg">
            <Link href="/">Try Again</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show generated image
  if (generatedImage) {
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

          <h1 className="text-2xl font-bold mb-4">Your QR Code is Ready!</h1>
          
          <div className="relative group mb-6">
            <img
              src={generatedImage}
              alt="Generated QR Code"
              className="max-w-sm w-full rounded-lg shadow-xl mx-auto"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <p className="text-white text-sm">Scan to test!</p>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={handleDownload}>
              Download
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/">Create Another</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default success state (for lifetime purchases without pending generation)
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
            You now have unlimited access to generate artistic QR codes, forever!
          </p>
        ) : (
          <p className="text-muted-foreground mb-6">
            Thank you for your purchase!
          </p>
        )}

        <Button asChild size="lg">
          <Link href="/">Start Creating</Link>
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
