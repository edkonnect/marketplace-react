import Navigation from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Search, Star, DollarSign, BookOpen, Clock } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TutorListing() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: tutors, isLoading } = trpc.tutorProfile.list.useQuery();

  const filteredTutors = tutors?.filter(tutor => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      tutor.userName?.toLowerCase().includes(term) ||
      tutor.subjects?.toLowerCase().includes(term) ||
      tutor.bio?.toLowerCase().includes(term)
    );
  });

  const parseSubjects = (subjects: string | null) => {
    if (!subjects) return [];
    try {
      return JSON.parse(subjects);
    } catch {
      return [];
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <div className="flex-1 mt-20">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-background border-b border-border">
          <div className="container py-12">
            <h1 className="text-4xl font-bold mb-4">Find Your Perfect Tutor</h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
              Browse through our qualified tutors and find the perfect match for your learning needs.
            </p>

            {/* Search Bar */}
            <div className="relative max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, subject, or keyword..."
                className="pl-10 h-12 text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tutor Grid */}
        <div className="container py-12">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full mb-4" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTutors && filteredTutors.length > 0 ? (
            <>
              <div className="mb-6 text-sm text-muted-foreground">
                Showing {filteredTutors.length} {filteredTutors.length === 1 ? 'tutor' : 'tutors'}
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTutors.map((tutor) => {
                  const subjects = parseSubjects(tutor.subjects);
                  const rating = tutor.rating ? parseFloat(tutor.rating) : 0;
                  const hourlyRate = tutor.hourlyRate ? parseFloat(tutor.hourlyRate) : 0;

                  return (
                    <Card key={tutor.id} className="hover:shadow-elegant transition-all duration-300 hover:border-primary/50 flex flex-col">
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3 flex-1">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={tutor.profileImageUrl || undefined} alt={tutor.userName || "Tutor"} />
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {(tutor.userName || "T").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <CardTitle className="text-xl mb-1">{tutor.userName || "Tutor"}</CardTitle>
                              {tutor.yearsOfExperience && (
                                <CardDescription className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {tutor.yearsOfExperience} years experience
                                </CardDescription>
                              )}
                            </div>
                          </div>
                          {rating > 0 && (
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span>{rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>

                        {/* Subjects */}
                        {subjects.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {subjects.slice(0, 3).map((subject: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {subject}
                              </Badge>
                            ))}
                            {subjects.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{subjects.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardHeader>

                      <CardContent className="flex-1 flex flex-col">
                        {/* Bio */}
                        {tutor.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                            {tutor.bio}
                          </p>
                        )}

                        {/* Qualifications */}
                        {tutor.qualifications && (
                          <div className="flex items-start gap-2 text-sm text-muted-foreground mb-4">
                            <BookOpen className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p className="line-clamp-2">{tutor.qualifications}</p>
                          </div>
                        )}

                        {/* Hourly Rate */}
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                          {hourlyRate > 0 && (
                            <div className="flex items-center gap-1 text-lg font-semibold text-primary">
                              <DollarSign className="w-5 h-5" />
                              <span>{hourlyRate}</span>
                              <span className="text-sm text-muted-foreground font-normal">/hour</span>
                            </div>
                          )}
                          <Button asChild size="sm" className="ml-auto">
                            <Link href={`/tutor-profile/${tutor.id}`}>
                              View Profile
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No tutors found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Try adjusting your search terms" : "No tutors available at the moment"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
