"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Navigation } from "@/components/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const QR_STYLES = [
  { id: "controlnet-blend", name: "ControlNet Blend ✨", description: "QR becomes part of the image texture - best integration", badge: "NEW" },
  { id: "controlnet-artistic", name: "AI ControlNet", description: "AI-generated artistic QR - best quality & scannability", badge: "RECOMMENDED" },
  { id: "glass", name: "Frosted Glass", description: "QR on frosted glass overlay - 100% scannable" },
  { id: "dots", name: "Artistic Dots", description: "QR with circular dot pattern" },
  { id: "rounded", name: "Rounded Squares", description: "QR with rounded corners" },
  { id: "qrbtf-bubble", name: "Bubble", description: "Playful circles with organic feel", badge: "QRBTF" },
  { id: "qrbtf-25d", name: "3D Isometric", description: "Colorful 3D cube effect", badge: "QRBTF" },
  { id: "qrbtf-dsj", name: "Designer", description: "Artistic with X patterns and colors", badge: "QRBTF" },
  { id: "ai-artistic", name: "AI Artistic (Beta)", description: "AI-generated artistic QR - may vary in scannability" },
];

// Progress phases with targets and status messages
const PROGRESS_PHASES = [
  { target: 20, status: "Preparing...", duration: 1500 },
  { target: 50, status: "Generating QR pattern...", duration: 3000 },
  { target: 75, status: "Applying AI enhancement...", duration: 4000 },
  { target: 90, status: "Finalizing...", duration: 2000 },
];

// Easing function for smooth progress
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<typeof GALLERY_IMAGES[0] | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string>("");
  const [generationId, setGenerationId] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [savedQRId, setSavedQRId] = useState<number | null>(null);
  const [savingPublic, setSavingPublic] = useState(false);
  const [qrStyle, setQrStyle] = useState("controlnet-blend");

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
    setProgressStatus("Initializing...");
    setIsPublic(false);
    setSavedQRId(null);

    // Smooth phased progress animation
    let currentProgress = 0;
    let phaseIndex = 0;
    let phaseStartTime = Date.now();
    let phaseStartProgress = 0;
    
    const animateProgress = () => {
      if (phaseIndex >= PROGRESS_PHASES.length) return;
      
      const phase = PROGRESS_PHASES[phaseIndex];
      const elapsed = Date.now() - phaseStartTime;
      const phaseProgress = Math.min(elapsed / phase.duration, 1);
      const easedProgress = easeOutCubic(phaseProgress);
      
      const progressRange = phase.target - phaseStartProgress;
      currentProgress = phaseStartProgress + (progressRange * easedProgress);
      
      setProgress(currentProgress);
      setProgressStatus(phase.status);
      
      // Move to next phase when current one completes
      if (phaseProgress >= 1 && phaseIndex < PROGRESS_PHASES.length - 1) {
        phaseIndex++;
        phaseStartTime = Date.now();
        phaseStartProgress = currentProgress;
      }
    };
    
    const progressInterval = setInterval(animateProgress, 50);

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
          style: qrStyle,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Smooth completion animation
      clearInterval(progressInterval);
      setProgressStatus("Complete!");
      
      // Animate from current to 100%
      const finalStart = currentProgress;
      const finalStartTime = Date.now();
      const finalDuration = 300;
      
      const completeAnimation = setInterval(() => {
        const elapsed = Date.now() - finalStartTime;
        const t = Math.min(elapsed / finalDuration, 1);
        const eased = easeOutCubic(t);
        setProgress(finalStart + (100 - finalStart) * eased);
        
        if (t >= 1) {
          clearInterval(completeAnimation);
          setGeneratedImage(data.imageUrl);
          setGeneratedUrl(url);
          setGenerationId(data.generationId);
          setGenerating(false);
          setProgress(0);
          setProgressStatus("");
        }
      }, 16);
      
    } catch (error) {
      console.error("Generation failed:", error);
      alert("Generation failed. Please try again.");
      clearInterval(progressInterval);
      setGenerating(false);
      setProgress(0);
      setProgressStatus("");
    }
  };

  const handlePublicToggle = async (checked: boolean) => {
    if (!generatedImage) return;
    
    setSavingPublic(true);
    
    try {
      if (savedQRId) {
        // Update existing QR code visibility
        const response = await fetch(`/api/qr/${savedQRId}/visibility`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublic: checked }),
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        setIsPublic(checked);
      } else if (checked) {
        // Save new QR code as public
        const response = await fetch("/api/qr/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: generatedUrl,
            imageUrl: generatedImage,
            description: selectedImage?.name || uploadedImageName || "Artistic QR Code",
            isPublic: true,
          }),
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        setSavedQRId(data.qrCode.id);
        setIsPublic(true);
      }
    } catch (error) {
      console.error("Failed to update public status:", error);
      // Revert the toggle on error
      setIsPublic(!checked);
    } finally {
      setSavingPublic(false);
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
      <Navigation />
      
      <div className="container mx-auto px-4 py-12 max-w-5xl">
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
                
                {/* Make Public Toggle */}
                <div className="flex items-center gap-3 bg-secondary/50 px-4 py-3 rounded-lg">
                  <Switch
                    id="public-toggle"
                    checked={isPublic}
                    onCheckedChange={handlePublicToggle}
                    disabled={savingPublic}
                  />
                  <Label htmlFor="public-toggle" className="text-sm cursor-pointer">
                    {savingPublic ? "Saving..." : "Share to public gallery"}
                  </Label>
                  {isPublic && (
                    <span className="text-xs text-green-500 ml-2">✓ Shared</span>
                  )}
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
                      setIsPublic(false);
                      setSavedQRId(null);
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

            {/* Style Selection */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <Label className="text-lg font-medium mb-3 block">
                  QR Code Style
                </Label>
                <Select value={qrStyle} onValueChange={setQrStyle}>
                  <SelectTrigger className="w-full h-12">
                    <SelectValue placeholder="Select a style" />
                  </SelectTrigger>
                  <SelectContent>
                    {QR_STYLES.map((style) => (
                      <SelectItem key={style.id} value={style.id}>
                        <div className="flex flex-col">
                          <span className="font-medium flex items-center gap-2">
                            {style.name}
                            {"badge" in style && style.badge && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full font-semibold">
                                {style.badge}
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">{style.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              {generating ? (
                <div className="flex flex-col items-center gap-4 w-full max-w-md">
                  {/* Progress bar container */}
                  <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-100 ease-out relative"
                      style={{ width: `${progress}%` }}
                    >
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                    </div>
                  </div>
                  
                  {/* Status text and percentage */}
                  <div className="flex items-center justify-between w-full text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
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
                      {progressStatus}
                    </span>
                    <span className="font-mono font-semibold text-primary">
                      {Math.round(progress)}%
                    </span>
                  </div>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="text-lg px-12 h-14"
                  disabled={!url || !currentImage}
                  onClick={handleGenerate}
                >
                  Generate QR Code
                </Button>
              )}
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
