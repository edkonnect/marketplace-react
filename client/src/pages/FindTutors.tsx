import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { TutorFilters, TutorFilterState } from "@/components/TutorFilters";
import { WeeklyAvailabilityCalendar } from "@/components/WeeklyAvailabilityCalendar";
import { AcuitySchedulingEmbed } from "@/components/AcuitySchedulingEmbed";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Clock, BookOpen, Award } from "lucide-react";
import { toast } from "sonner";

export function FindTutors() {
  const [filters, setFilters] = useState<TutorFilterState>({
    subjects: [],
    gradeLevels: [],
    minRate: undefined,
    maxRate: undefined,
    minRating: 0,
  });

  const { data: tutors, isLoading, refetch } = trpc.tutors.search.useQuery(filters, {
    enabled: false, // Only search when user clicks search button
  });

  const handleSearch = () => {
    refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 mt-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Find Your Perfect Tutor</h1>
          <p className="text-muted-foreground">
            Search and filter tutors by subject, availability, and rating
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <TutorFilters
              filters={filters}
              onChange={setFilters}
              onSearch={handleSearch}
            />
          </div>

          {/* Search Results */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Searching for tutors...</p>
              </div>
            ) : tutors === undefined ? (
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Start Your Search</h3>
                <p className="text-muted-foreground">
                  Use the filters on the left to find tutors that match your needs
                </p>
              </div>
            ) : tutors.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  No tutors found matching your criteria
                </p>
                <Button variant="outline" onClick={() => setFilters({ 
                  subjects: [], 
                  gradeLevels: [],
                  minRate: undefined,
                  maxRate: undefined,
                  minRating: 0 
                })}>
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Found {tutors.length} tutor{tutors.length !== 1 ? "s" : ""}
                </p>

                {tutors.map((tutor) => (
                  <TutorCard key={tutor.id} tutor={tutor} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TutorCardProps {
  tutor: any;
}

function TutorCard({ tutor }: TutorCardProps) {
  const rating = tutor.rating ? parseFloat(tutor.rating as string) : 0;
  
  // Handle both JSON array and comma-separated string formats
  let subjects: string[] = [];
  if (tutor.subjects) {
    try {
      subjects = JSON.parse(tutor.subjects as string);
    } catch {
      // If JSON parse fails, treat as comma-separated string
      subjects = (tutor.subjects as string).split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  
  let gradeLevels: string[] = [];
  if (tutor.gradeLevels) {
    try {
      gradeLevels = JSON.parse(tutor.gradeLevels as string);
    } catch {
      // If JSON parse fails, treat as comma-separated string
      gradeLevels = (tutor.gradeLevels as string).split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
          <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={tutor.profileImageUrl || undefined} alt={tutor.userName || 'Tutor'} />
              <AvatarFallback className="text-2xl font-bold">
                {tutor.userName?.charAt(0).toUpperCase() || "T"}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{tutor.userName || "Tutor"}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                {rating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">
                      ({tutor.totalReviews} review{tutor.totalReviews !== 1 ? "s" : ""})
                    </span>
                  </div>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            {tutor.hourlyRate && (
              <div className="text-2xl font-bold text-primary">
                ${parseFloat(tutor.hourlyRate as string).toFixed(0)}
                <span className="text-sm font-normal text-muted-foreground">/hr</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Video Preview */}
        {tutor.introVideoUrl && (
          <div className="aspect-video bg-muted rounded-lg overflow-hidden relative group">
            <video
              src={tutor.introVideoUrl}
              className="w-full h-full object-cover"
              muted
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center">
                <svg className="h-6 w-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Bio */}
        {tutor.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2">{tutor.bio}</p>
        )}

        {/* Subjects */}
        {subjects.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4" />
              Subjects
            </div>
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject: string) => (
                <Badge key={subject} variant="secondary">
                  {subject}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Grade Levels */}
        {gradeLevels.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Award className="h-4 w-4" />
              Grade Levels
            </div>
            <div className="flex flex-wrap gap-2">
              {gradeLevels.map((grade: string) => (
                <Badge key={grade} variant="outline">
                  {grade}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Experience */}
        {tutor.yearsOfExperience && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {tutor.yearsOfExperience} years of experience
          </div>
        )}

        {/* Qualifications */}
        {tutor.qualifications && (
          <div className="text-sm text-muted-foreground">
            <strong>Qualifications:</strong> {tutor.qualifications}
          </div>
        )}

        {/* Availability - Show Acuity if available, otherwise show manual calendar */}
        {tutor.acuityLink ? (
          <AcuitySchedulingEmbed 
            acuityLink={tutor.acuityLink} 
            compact={true}
          />
        ) : tutor.availability && tutor.availability.length > 0 ? (
          <WeeklyAvailabilityCalendar 
            availability={tutor.availability} 
            compact={true}
          />
        ) : null}

        <div className="flex gap-2 pt-2">
          <Button className="flex-1">View Profile</Button>
          <Button variant="outline" className="flex-1">
            Book Session
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
