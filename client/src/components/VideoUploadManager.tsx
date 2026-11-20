import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, Video, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VideoUploadManagerProps {
  currentVideoUrl?: string | null;
  onUploadComplete?: () => void;
}

export function VideoUploadManager({ currentVideoUrl, onUploadComplete }: VideoUploadManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const uploadVideo = trpc.tutorProfile.uploadIntroVideo.useMutation({
    onSuccess: () => {
      toast.success("Video uploaded successfully!");
      utils.tutorProfile.getMy.invalidate();
      onUploadComplete?.();
      setUploading(false);
      setUploadProgress(0);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload video");
      setUploading(false);
      setUploadProgress(0);
    },
  });

  const deleteVideo = trpc.tutorProfile.deleteIntroVideo.useMutation({
    onSuccess: () => {
      toast.success("Video deleted successfully!");
      utils.tutorProfile.getMy.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete video");
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only MP4, WebM, and MOV videos are allowed.");
      return;
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast.error("File size exceeds 50MB limit.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        const base64Content = base64Data.split(',')[1]; // Remove data:video/...;base64, prefix

        setUploadProgress(30);

        await uploadVideo.mutateAsync({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          base64Data: base64Content,
        });
      };

      reader.onerror = () => {
        toast.error("Failed to read file");
        setUploading(false);
        setUploadProgress(0);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      setUploading(false);
      setUploadProgress(0);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete your intro video?")) {
      deleteVideo.mutate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Introduction Video
        </CardTitle>
        <CardDescription>
          Upload a short video (max 50MB) to introduce yourself to potential students
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentVideoUrl ? (
          <div className="space-y-4">
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video
                src={currentVideoUrl}
                controls
                className="w-full h-full object-contain"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || deleteVideo.isPending}
              >
                <Upload className="h-4 w-4 mr-2" />
                Replace Video
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={uploading || deleteVideo.isPending}
              >
                {deleteVideo.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Delete Video
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Click to upload your introduction video
              </p>
              <p className="text-xs text-muted-foreground">
                MP4, WebM, or MOV (max 50MB)
              </p>
            </div>
          </div>
        )}

        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Uploading...</span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={handleFileSelect}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
}