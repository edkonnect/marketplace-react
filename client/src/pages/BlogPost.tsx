import React from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowLeft, Calendar } from "lucide-react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";

// Renders inline markdown: **bold**, *italic*, `code`
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}

function renderMarkdown(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table: starts with |
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // Parse header, separator, rows
      const [headerLine, , ...rowLines] = tableLines;
      const parseRow = (l: string) =>
        l.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      const headers = parseRow(headerLine);
      const rows = rowLines.map(parseRow);
      elements.push(
        <div key={i} className="overflow-x-auto my-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-primary/10">
                {headers.map((h, hi) => (
                  <th key={hi} className="border border-border px-4 py-2 text-left font-semibold text-foreground">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-background" : "bg-muted/40"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-border px-4 py-2 text-foreground">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-2xl font-bold mt-8 mb-3">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-xl font-semibold mt-6 mb-2">{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith("#### ")) {
      elements.push(<h4 key={i} className="text-lg font-semibold mt-4 mb-2">{renderInline(line.slice(5))}</h4>);
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">
          {renderInline(line.slice(2))}
        </blockquote>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      // Collect consecutive list items
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        listItems.push(lines[i].replace(/^[-*] /, ""));
        i++;
      }
      elements.push(
        <ul key={i} className="list-disc ml-6 space-y-1 my-3">
          {listItems.map((item, li) => (
            <li key={li} className="text-foreground leading-relaxed">{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    } else if (/^\d+\. /.test(line)) {
      // Ordered list
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={i} className="list-decimal ml-6 space-y-1 my-3">
          {listItems.map((item, li) => (
            <li key={li} className="text-foreground leading-relaxed">{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    } else if (line.trim() === "") {
      elements.push(<br key={i} />);
    } else {
      elements.push(<p key={i} className="mb-3 leading-relaxed text-foreground">{renderInline(line)}</p>);
    }

    i++;
  }

  return elements;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = trpc.home.blogPost.useQuery(
    { slug: slug! },
    { enabled: !!slug }
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 mt-20">
        {isLoading ? (
          <div className="container max-w-3xl py-16">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-8 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-64 bg-muted rounded" />
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-muted rounded" />)}
              </div>
            </div>
          </div>
        ) : post ? (
          <>
            {/* Hero */}
            <section className="bg-gradient-to-br from-primary/5 via-primary/10 to-background py-16 border-b border-border">
              <div className="container max-w-3xl">
                <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
                  <Link href="/blog">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Blog
                  </Link>
                </Button>

                {post.category && (
                  <span className="inline-block px-3 py-1 text-xs font-semibold text-primary bg-primary/10 rounded-full mb-4">
                    {post.category}
                  </span>
                )}

                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
                  {post.title}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {post.publishedAt && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {new Date(post.publishedAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  {post.readTime && (
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      {post.readTime} min read
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* Cover Image */}
            {post.coverImageUrl && (
              <div className="container max-w-3xl pt-10">
                <img
                  src={post.coverImageUrl}
                  alt={post.title}
                  className="w-full rounded-xl object-cover max-h-[400px]"
                />
              </div>
            )}

            {/* Content */}
            <section className="py-10">
              <div className="container max-w-3xl">
                <div className="prose prose-lg dark:prose-invert max-w-none">
                  {renderMarkdown(post.content ?? "")}
                </div>

                {/* Tags */}
                {post.tags && (() => {
                  try {
                    const tags: string[] = JSON.parse(post.tags);
                    return tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-border">
                        {tags.map((tag) => (
                          <span key={tag} className="px-3 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null;
                  } catch { return null; }
                })()}

                <div className="mt-10 pt-6 border-t border-border">
                  <Button asChild variant="outline">
                    <Link href="/blog">
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Back to Blog
                    </Link>
                  </Button>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className="container max-w-3xl py-20 text-center">
            <p className="text-muted-foreground text-lg mb-6">Blog post not found.</p>
            <Button asChild>
              <Link href="/blog">Back to Blog</Link>
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
