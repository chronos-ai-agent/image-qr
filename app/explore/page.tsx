"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Navigation } from "@/components/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface QRCode {
  id: number;
  url: string;
  image_url: string;
  description: string | null;
  created_at: string;
}

export default function ExplorePage() {
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedQR, setSelectedQR] = useState<QRCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchQRCodes = useCallback(async (pageNum: number) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/qr/public?page=${pageNum}&limit=12`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (pageNum === 1) {
        setQrCodes(data.qrCodes);
      } else {
        setQrCodes((prev) => [...prev, ...data.qrCodes]);
      }
      
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      console.error("Failed to fetch QR codes:", err);
      setError(err instanceof Error ? err.message : "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Initial load
  useEffect(() => {
    fetchQRCodes(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading]);

  // Fetch more when page changes
  useEffect(() => {
    if (page > 1) {
      fetchQRCodes(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Explore Gallery
          </h1>
          <p className="text-muted-foreground">
            Discover beautiful QR codes created by our community
          </p>
        </div>

        {error && (
          <Card className="mb-8 border-destructive">
            <CardContent className="p-4 text-center text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {qrCodes.length === 0 && !loading && !error && (
          <Card className="mb-8">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground text-lg mb-4">
                No public QR codes yet
              </p>
              <p className="text-sm text-muted-foreground">
                Be the first to share your creation!
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {qrCodes.map((qr) => (
            <Card
              key={qr.id}
              className="cursor-pointer overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
              onClick={() => setSelectedQR(qr)}
            >
              <CardContent className="p-0">
                <div className="aspect-square relative">
                  <img
                    src={qr.image_url}
                    alt={qr.description || "QR Code"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">
                    {qr.description || "Artistic QR Code"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(qr.created_at)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Load more trigger */}
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
              Loading...
            </div>
          )}
          {!hasMore && qrCodes.length > 0 && (
            <p className="text-muted-foreground text-sm">
              You&apos;ve seen all the QR codes!
            </p>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedQR?.description || "Artistic QR Code"}
            </DialogTitle>
          </DialogHeader>
          {selectedQR && (
            <div className="space-y-4">
              <div className="relative group rounded-lg overflow-hidden">
                <img
                  src={selectedQR.image_url}
                  alt={selectedQR.description || "QR Code"}
                  className="w-full rounded-lg"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-sm">Scan to visit link!</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Created {formatDate(selectedQR.created_at)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = selectedQR.image_url;
                    link.download = `qr-${selectedQR.id}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
