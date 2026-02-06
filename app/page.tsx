"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GALLERY_IMAGES = [
  // Calm / Zen
  { id: 1, src: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=400&fit=crop", name: "Ocean Calm", category: "calm" },
  { id: 2, src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=400&fit=crop", name: "Serene Beach", category: "calm" },
  { id: 3, src: "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=400&h=400&fit=crop", name: "Gentle Shores", category: "calm" },
  { id: 4, src: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=400&fit=crop", name: "Zen Meditation", category: "calm" },
  { id: 5, src: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&h=400&fit=crop", name: "Sunset Reflection", category: "calm" },
  { id: 6, src: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&h=400&fit=crop", name: "Still Waters", category: "calm" },
  
  // Gradients
  { id: 7, src: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=400&h=400&fit=crop", name: "Purple Dream", category: "gradient" },
  { id: 8, src: "https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=400&h=400&fit=crop", name: "Soft Blush", category: "gradient" },
  { id: 9, src: "https://images.unsplash.com/photo-1557682260-96773eb01377?w=400&h=400&fit=crop", name: "Pastel Flow", category: "gradient" },
  { id: 10, src: "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=400&h=400&fit=crop", name: "Warm Glow", category: "gradient" },
  { id: 11, src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop", name: "Aurora Soft", category: "gradient" },
  
  // Minimal
  { id: 12, src: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=400&h=400&fit=crop", name: "Soft Clouds", category: "minimal" },
  { id: 13, src: "https://images.unsplash.com/photo-1553356084-58ef4a67b2a7?w=400&h=400&fit=crop", name: "Pink Abstract", category: "minimal" },
  { id: 14, src: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop", name: "Clean Lines", category: "minimal" },
  { id: 15, src: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=400&h=400&fit=crop", name: "Marble Flow", category: "minimal" },
  
  // Nature (calm, soft light)
  { id: 16, src: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=400&fit=crop", name: "Misty Valley", category: "nature" },
  { id: 17, src: "https://images.unsplash.com/photo-1489549132488-d00b7eee80f1?w=400&h=400&fit=crop", name: "Foggy Peaks", category: "nature" },
  { id: 18, src: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=400&fit=crop", name: "Forest Canopy", category: "nature" },
  { id: 19, src: "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=400&h=400&fit=crop", name: "Golden Hour", category: "nature" },
  
  // Abstract (mix of calm and vibrant)
  { id: 20, src: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=400&fit=crop", name: "Fluid Art", category: "abstract" },
  { id: 21, src: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&h=400&fit=crop", name: "Color Burst", category: "abstract" },
  { id: 22, src: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400&h=400&fit=crop", name: "Neon Waves", category: "abstract" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<typeof GALLERY_IMAGES[0] | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Check user status on load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionId = localStorage.getItem("session_id");
    if (sessionId) {
      fetch(`/api/user?session_id=${sessionId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.is_pro) setIsPro(true);
        })
        .catch(() => {});
    }
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      setUploadedImageName(file.name.replace(/\.[^/.]+$/, ""));
      setSelectedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!url) return;
    if (!selectedImage && !uploadedImage) return;

    setGenerating(true);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 500);

    try {
      const sessionId = localStorage.getItem("session_id") || crypto.randomUUID();
      localStorage.setItem("session_id", sessionId);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          imageDescription: selectedImage?.name || uploadedImageName || "artistic image",
          imageUrl: selectedImage?.src || uploadedImage,
          sessionId,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setProgress(100);
      setGeneratedImage(data.imageUrl);
      setGenerationId(data.generationId);
    } catch (error) {
      console.error("Generation failed:", error);
      alert("Generation failed. Please try again.");
    } finally {
      clearInterval(progressInterval);
      setGenerating(false);
      setProgress(0);
    }
  };

  const handleDownload = () => {
    if (isPro) {
      downloadImage(false);
    } else {
      setShowPaymentModal(true);
    }
  };

  const downloadImage = (withWatermark: boolean) => {
    if (!generatedImage) return;
    
    const link = document.createElement("a");
    link.href = withWatermark ? `${generatedImage}?watermark=true` : generatedImage;
    link.download = `qr-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (!withWatermark) {
      setShowPaymentModal(false);
    }
  };

  const handleSinglePurchase = async () => {
    const sessionId = localStorage.getItem("session_id");
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "single",
        generationId,
        sessionId,
      }),
    });
    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const handleLifetimePurchase = () => {
    setShowPaymentModal(false);
    setShowEmailModal(true);
  };

  const handleEmailSubmit = async () => {
    if (!email) return;
    
    const sessionId = localStorage.getItem("session_id");
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "lifetime",
        email,
        sessionId,
        generationId,
      }),
    });
    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const currentImage = selectedImage?.src || uploadedImage;

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Turn any image into a scannable QR code
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
            Create beautiful, artistic QR codes that blend seamlessly with any image using AI
          </p>
        </div>

        {/* Result Preview */}
        {generatedImage ? (
          <Card className="mb-8 overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-6">
                <div className="relative group">
                  <img
                    src={generatedImage}
                    alt="Generated QR Code"
                    className="max-w-md w-full rounded-lg shadow-2xl"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <p className="text-white text-sm">Scan to test!</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button size="lg" onClick={handleDownload}>
                    Download
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      setGeneratedImage(null);
                      setGenerationId(null);
                    }}
                  >
                    Create Another
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* URL Input */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <Label htmlFor="url" className="text-lg font-medium mb-2 block">
                  Enter your URL
                </Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="text-lg h-12"
                />
              </CardContent>
            </Card>

            {/* Image Selection */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <Tabs defaultValue="gallery" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="gallery">Choose from Gallery</TabsTrigger>
                    <TabsTrigger value="upload">Upload Your Own</TabsTrigger>
                  </TabsList>

                  <TabsContent value="gallery">
                    <Tabs defaultValue="all" className="w-full">
                      <TabsList className="mb-4 flex-wrap h-auto gap-1">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="calm">Calm</TabsTrigger>
                        <TabsTrigger value="gradient">Gradient</TabsTrigger>
                        <TabsTrigger value="minimal">Minimal</TabsTrigger>
                        <TabsTrigger value="nature">Nature</TabsTrigger>
                        <TabsTrigger value="abstract">Abstract</TabsTrigger>
                      </TabsList>

                      {["all", "calm", "gradient", "minimal", "nature", "abstract"].map((category) => (
                        <TabsContent key={category} value={category}>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {GALLERY_IMAGES.filter(
                              (img) => category === "all" || img.category === category
                            ).map((image) => (
                              <div
                                key={image.id}
                                onClick={() => {
                                  setSelectedImage(image);
                                  setUploadedImage(null);
                                }}
                                className={`relative cursor-pointer rounded-lg overflow-hidden transition-all hover:scale-105 ${
                                  selectedImage?.id === image.id
                                    ? "ring-4 ring-primary"
                                    : ""
                                }`}
                              >
                                <img
                                  src={image.src}
                                  alt={image.name}
                                  className="w-full aspect-square object-cover"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2">
                                  <p className="text-white text-sm truncate">
                                    {image.name}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </TabsContent>

                  <TabsContent value="upload">
                    <div
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                        dragActive
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25"
                      }`}
                    >
                      {uploadedImage ? (
                        <div className="flex flex-col items-center gap-4">
                          <img
                            src={uploadedImage}
                            alt="Uploaded"
                            className="max-w-xs rounded-lg"
                          />
                          <Button
                            variant="outline"
                            onClick={() => setUploadedImage(null)}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-muted-foreground mb-4">
                            Drag and drop an image here, or click to select
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id="file-upload"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleFile(e.target.files[0]);
                              }
                            }}
                          />
                          <Button asChild variant="outline">
                            <label htmlFor="file-upload" className="cursor-pointer">
                              Select Image
                            </label>
                          </Button>
                        </>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <div className="text-center">
              <Button
                size="lg"
                className="text-lg px-12 h-14"
                disabled={!url || !currentImage || generating}
                onClick={handleGenerate}
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
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
                    Generating... {Math.round(progress)}%
                  </span>
                ) : (
                  "Generate QR Code"
                )}
              </Button>
            </div>
          </>
        )}

        {/* Payment Modal */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Your QR is ready!</DialogTitle>
              <DialogDescription>
                Choose your download option
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={handleSinglePurchase}
              >
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">Single Download</p>
                    <p className="text-sm text-muted-foreground">
                      This image only, no watermark
                    </p>
                  </div>
                  <p className="text-2xl font-bold">$3</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary transition-colors border-primary/50 bg-primary/5"
                onClick={handleLifetimePurchase}
              >
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">Unlimited Forever</p>
                    <p className="text-sm text-muted-foreground">
                      Download all QR codes, forever
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">$10</p>
                    <p className="text-xs text-green-500">Best value</p>
                  </div>
                </CardContent>
              </Card>

              <div className="text-center pt-2">
                <button
                  onClick={() => downloadImage(true)}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  Download with watermark (free)
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Email Modal for Lifetime */}
        <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Your Account</DialogTitle>
              <DialogDescription>
                Enter your email to unlock unlimited downloads forever
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button className="w-full" onClick={handleEmailSubmit}>
                Continue to Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <footer className="text-center mt-16 text-sm text-muted-foreground">
          <p>Powered by AI • Scan-tested QR codes</p>
        </footer>
      </div>
    </main>
  );
}
