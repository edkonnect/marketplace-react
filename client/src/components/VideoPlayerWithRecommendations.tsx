import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Play } from "lucide-react";
import { Link } from "wouter";

interface VideoPlayerWithRecommendationsProps {
  videoUrl: string;
  tutorId: number;
  tutorName: string;
}

export function VideoPlayerWithRecommendations({
  videoUrl,
  tutorId,
  tutorName
}: VideoPlayerWithRecommendationsProps) {
  const [showRecommendations, setShowRecommendations] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const formatPrice = useFormatPrice();

  const { data: similarTutors, isLoading } = trpc.tutorProfile.getSimilar.useQuery(
    { tutorId, limit: 2 },
    { enabled: showRecommendations }
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setShowRecommendations(true);
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, []);

  return (
    <div className="space-y-6">
      {/* Video Player */}
      <div className="aspect-video bg-muted rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="w-full h-full object-cover"
        >
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Recommendations */}
      {showRecommendations && (
        <Card>
          <CardHeader>
            <CardTitle>Watch Next</CardTitle>
            <CardDescription>
              Other tutors you might be interested in
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading recommendations...
              </div>
            ) : similarTutors && similarTutors.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {similarTutors.map((tutor: any) => (
                  <Link key={tutor.userId} href={`/tutors/${tutor.userId}`}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                      <CardContent className="p-4 space-y-3">
                        {/* Video Thumbnail */}
                        {tutor.introVideoUrl && (
                          <div className="aspect-video bg-muted rounded-lg overflow-hidden relative group">
                            <video
                              src={tutor.introVideoUrl}
                              className="w-full h-full object-cover"
                              muted
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Play className="h-6 w-6 text-primary ml-1" fill="currentColor" />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Tutor Info */}
                        <div>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-semibold text-lg">{tutor.userName}</h3>
                              {tutor.rating && parseFloat(tutor.rating) > 0 && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                  <span className="font-medium">{parseFloat(tutor.rating).toFixed(1)}</span>
                                  <span className="text-muted-foreground">
                                    ({tutor.totalReviews})
                                  </span>
                                </div>
                              )}
                            </div>
                            {tutor.hourlyRate && (
                              <div className="text-right">
                                <div className="text-xl font-bold text-primary">
                                  {formatPrice(tutor.hourlyRate, "/hr")}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Bio */}
                          {tutor.bio && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {tutor.bio}
                            </p>
                          )}

                          {/* Subjects */}
                          {tutor.subjects && (
                            <div className="flex flex-wrap gap-1">
                              {JSON.parse(tutor.subjects).slice(0, 3).map((subject: string) => (
                                <Badge key={subject} variant="secondary" className="text-xs">
                                  {subject}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* View Profile Button */}
                        <Button className="w-full" size="sm">
                          View Profile
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No similar tutors found at the moment.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
