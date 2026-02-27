import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, DollarSign, Calendar, GraduationCap, BookOpen, Star } from "lucide-react";

export default function TutorProfile() {
  const params = useParams();
  const [, navigate] = useLocation();
  const tutorId = params.id ? parseInt(params.id) : 0;

  const { data: tutor, isLoading, error } = trpc.tutorProfile.getById.useQuery(
    { id: tutorId },
    { enabled: tutorId > 0 }
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 px-4 mt-20">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !tutor) {
    return (
      <div className="container mx-auto py-12 px-4 mt-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Tutor Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The tutor profile you're looking for doesn't exist or is not available.
          </p>
          <Button onClick={() => navigate("/tutors")}>
            Browse All Tutors
          </Button>
        </div>
      </div>
    );
  }

  // Parse JSON fields
  const subjects = typeof tutor.subjects === 'string' ? JSON.parse(tutor.subjects) : tutor.subjects;
  const gradeLevels = typeof tutor.gradeLevels === 'string' ? JSON.parse(tutor.gradeLevels) : tutor.gradeLevels;

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Profile Image */}
              <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center text-5xl font-bold">
                {tutor.name?.charAt(0).toUpperCase() || 'T'}
              </div>

              {/* Name and Quick Info */}
              <div className="flex-1">
                <h1 className="text-4xl font-bold mb-2">{tutor.name}</h1>
                <div className="flex flex-wrap gap-4 text-white/90">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{tutor.yearsOfExperience || 0} years experience</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>${tutor.hourlyRate}/hour</span>
                  </div>
                  {tutor.rating && (
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>{tutor.rating} ({tutor.totalReviews || 0} reviews)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Button */}
              <div>
                <Button size="lg" className="bg-white text-blue-600 hover:bg-white/90">
                  Contact Tutor
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-12 px-4 mt-20">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* About Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                About Me
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {tutor.bio || "No bio provided."}
              </p>
            </CardContent>
          </Card>

          {/* Qualifications Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Qualifications & Education
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {tutor.qualifications || "No qualifications provided."}
              </p>
            </CardContent>
          </Card>

          {/* Subjects & Grade Levels */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Subjects */}
            <Card>
              <CardHeader>
                <CardTitle>Subjects I Teach</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {subjects && subjects.length > 0 ? (
                    subjects.map((subject: string) => (
                      <Badge key={subject} variant="secondary" className="text-sm">
                        {subject}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No subjects listed</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Grade Levels */}
            <Card>
              <CardHeader>
                <CardTitle>Grade Levels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {gradeLevels && gradeLevels.length > 0 ? (
                    gradeLevels.map((level: string) => (
                      <Badge key={level} variant="outline" className="text-sm">
                        {level}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No grade levels listed</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tutor.email && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Mail className="w-5 h-5" />
                    <a href={`mailto:${tutor.email}`} className="hover:text-primary">
                      {tutor.email}
                    </a>
                  </div>
                )}

              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-3">Ready to Start Learning?</h2>
            <p className="text-muted-foreground mb-6">
              Contact {tutor.name?.split(' ')[0] || 'this tutor'} today to schedule your first session and begin your learning journey.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                <Mail className="w-4 h-4 mr-2" />
                Send Message
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/tutors")}>
                Browse More Tutors
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
