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
  { id: 1, src: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=400&fit=crop", name: "Abstract Flow", category: "abstract" },
  { id: 2, src: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400&h=400&fit=crop", name: "Neon Waves", category: "abstract" },
  { id: 3, src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop", name: "Mountain Dawn", category: "nature" },
  { id: 4, src: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=400&fit=crop", name: "Misty Forest", category: "nature" },
  { id: 5, src: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=400&h=400&fit=crop", name: "Marble Texture", category: "patterns" },
  { id: 6, src: "https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=400&h=400&fit=crop", name: "Gradient Dream", category: "patterns" },
  { id: 7, src: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&h=400&fit=crop", name: "Color Burst", category: "abstract" },
  { id: 8, src: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=400&fit=crop", name: "Ocean Calm", category: "nature" },
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
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState(false);

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

  const handleGenerateClick = () => {
    if (!url) return;
    if (!selectedImage && !uploadedImage) return;

    // If user is pro, generate directly
    if (isPro) {
      doGenerate();
    } else {
      // Show purchase modal first
      setShowPurchaseModal(true);
    }
  };

  const doGenerate = async () => {
    if (!url) return;
    if (!selectedImage && !uploadedImage) return;

    setShowPurchaseModal(false);
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
    if (!generatedImage) return;
    
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `qr-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSinglePurchase = async () => {
    const sessionId = localStorage.getItem("session_id") || crypto.randomUUID();
    localStorage.setItem("session_id", sessionId);
    
    // Store pending generation info for after payment
    localStorage.setItem("pending_generation", JSON.stringify({
      url,
      imageDescription: selectedImage?.name || uploadedImageName || "artistic image",
      imageUrl: selectedImage?.src || uploadedImage,
    }));
    
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "single",
        sessionId,
      }),
    });
    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const handleLifetimePurchase = () => {
    setShowPurchaseModal(false);
    setShowEmailModal(true);
  };

  const handleEmailSubmit = async () => {
    if (!email) return;
    
    const sessionId = localStorage.getItem("session_id") || crypto.randomUUID();
    localStorage.setItem("session_id", sessionId);
    
    // Store pending generation info for after payment
    localStorage.setItem("pending_generation", JSON.stringify({
      url,
      imageDescription: selectedImage?.name || uploadedImageName || "artistic image",
      imageUrl: selectedImage?.src || uploadedImage,
    }));
    
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "lifetime",
        email,
        sessionId,
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
                      <TabsList className="mb-4">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="abstract">Abstract</TabsTrigger>
                        <TabsTrigger value="nature">Nature</TabsTrigger>
                        <TabsTrigger value="patterns">Patterns</TabsTrigger>
                      </TabsList>

                      {["all", "abstract", "nature", "patterns"].map((category) => (
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
                onClick={handleGenerateClick}
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
              {!isPro && (
                <p className="mt-2 text-sm text-muted-foreground">
                  $3 per QR code or $10 for unlimited forever
                </p>
              )}
            </div>
          </>
        )}

        {/* Purchase Modal - shown before generation */}
        <Dialog open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Generate Your QR Code</DialogTitle>
              <DialogDescription>
                Choose a plan to create your artistic QR code
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={handleSinglePurchase}
              >
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">Single QR Code</p>
                    <p className="text-sm text-muted-foreground">
                      Generate one artistic QR code
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
                      Generate unlimited QR codes, forever
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">$10</p>
                    <p className="text-xs text-green-500">Best value</p>
                  </div>
                </CardContent>
              </Card>
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
