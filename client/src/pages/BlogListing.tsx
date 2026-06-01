import React, { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, GraduationCap, Calculator, BookMarked, Users, Brain, Lightbulb, PenLine, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

const categoryConfig: Record<string, { gradient: string; icon: React.ElementType; iconColor: string }> = {
  "Digital SAT":  { gradient: "from-blue-500/20 via-indigo-500/20 to-purple-500/20", icon: PenLine,      iconColor: "text-indigo-500" },
  "SAT English":  { gradient: "from-emerald-500/20 via-teal-500/20 to-cyan-500/20",  icon: BookMarked,   iconColor: "text-emerald-500" },
  "Mathematics":  { gradient: "from-orange-500/20 via-amber-500/20 to-yellow-500/20", icon: Calculator,  iconColor: "text-orange-500" },
  "Education":    { gradient: "from-primary/20 via-primary/10 to-accent/20",          icon: GraduationCap, iconColor: "text-primary" },
  "Study Tips":   { gradient: "from-violet-500/20 via-purple-500/20 to-fuchsia-500/20", icon: Brain,     iconColor: "text-violet-500" },
  "Tutoring":     { gradient: "from-sky-500/20 via-blue-500/20 to-indigo-500/20",     icon: Users,       iconColor: "text-sky-500" },
  "Parenting":    { gradient: "from-rose-500/20 via-pink-500/20 to-red-500/20",       icon: Lightbulb,   iconColor: "text-rose-500" },
};

const defaultConfig = { gradient: "from-primary/20 via-accent/20 to-muted/20", icon: BookOpen, iconColor: "text-primary" };

const POSTS_PER_PAGE = 9;

function BlogCoverImage({ src, alt, category }: { src: string | null; alt: string; category: string | null }) {
  const [failed, setFailed] = useState(false);
  const config = categoryConfig[category ?? ""] ?? defaultConfig;
  const Icon = config.icon;

  if (!src || failed) {
    return (
      <div className={`w-full h-48 bg-gradient-to-br ${config.gradient} flex items-center justify-center relative overflow-hidden`}>
        <div className="absolute w-32 h-32 rounded-full bg-white/10 -top-6 -left-6 animate-pulse" />
        <div className="absolute w-20 h-20 rounded-full bg-white/10 bottom-4 right-4 animate-pulse delay-300" />
        <div className="absolute w-14 h-14 rounded-full bg-white/10 top-8 right-12 animate-pulse delay-700" />
        <Icon className={`w-16 h-16 ${config.iconColor} opacity-60 relative z-10`} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
    />
  );
}

export default function BlogListing() {
  const { data: posts = [], isLoading } = trpc.home.blogPosts.useQuery({});
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
  const paginatedPosts = posts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 mt-20">
        {/* Header */}
        <section className="relative bg-gradient-to-br from-primary/10 via-accent/5 to-background py-20 border-b border-border overflow-hidden">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
          <div className="container relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold text-primary bg-primary/10 rounded-full mb-4 tracking-wide uppercase">
                EdKonnect Blog
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-5 leading-tight">
                Insights for{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Academic Success
                </span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Strategies, tips, and expert advice to help students and parents navigate the learning journey.
              </p>
            </div>
          </div>
        </section>

        {/* Posts Grid */}
        <section className="py-16">
          <div className="container">
            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[...Array(9)].map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-48 w-full" />
                    <CardContent className="p-6">
                      <Skeleton className="h-4 w-24 mb-4 rounded-full" />
                      <Skeleton className="h-6 w-full mb-2" />
                      <Skeleton className="h-6 w-3/4 mb-4" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : posts.length > 0 ? (
              <>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {paginatedPosts.map((post) => (
                    <Link key={post.id} href={`/blog/${post.slug}`}>
                      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-primary/50 hover:-translate-y-1 group cursor-pointer h-full flex flex-col">
                        <div className="overflow-hidden">
                          <BlogCoverImage
                            src={post.coverImageUrl ?? null}
                            alt={post.title}
                            category={post.category ?? null}
                          />
                        </div>
                        <CardContent className="p-6 flex flex-col flex-1">
                          {post.category && (
                            <span className="inline-block px-3 py-1 text-xs font-semibold text-primary bg-primary/10 rounded-full mb-3 w-fit">
                              {post.category}
                            </span>
                          )}
                          <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors leading-snug">
                            {post.title}
                          </h2>
                          <p className="text-muted-foreground text-sm mb-4 line-clamp-3 flex-1">
                            {post.excerpt}
                          </p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border mt-auto">
                            {post.readTime && (
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" />
                                {post.readTime} min read
                              </span>
                            )}
                            {post.publishedAt && (
                              <span>
                                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-12">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>

                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                            currentPage === page
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "border border-border text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/50"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="text-lg">No blog posts available yet.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}