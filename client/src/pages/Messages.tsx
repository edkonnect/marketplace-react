import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, User, GraduationCap, ChevronRight, Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { LOGIN_PATH } from "@/const";

export default function Messages() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedTutorId, setSelectedTutorId] = useState<number | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const isParent = user?.role === "parent";
  const isTutor = user?.role === "tutor";

  const { data: studentsWithTutors, isLoading: studentsLoading } = trpc.messaging.getStudentsWithTutors.useQuery(
    undefined,
    { enabled: isAuthenticated && isParent }
  );

  const { data: tutorConversations, isLoading: tutorConversationsLoading } = trpc.messaging.getTutorConversations.useQuery(
    undefined,
    { enabled: isAuthenticated && isTutor }
  );

  const { data: messages, isLoading: messagesLoading, refetch: refetchMessages } = trpc.messaging.getMessages.useQuery(
    { conversationId: selectedConversationId! },
    { enabled: !!selectedConversationId }
  );

  const sendMessageMutation = trpc.messaging.sendMessage.useMutation();
  const markAsReadMutation = trpc.messaging.markAsRead.useMutation();
  const createConversationMutation = trpc.messaging.getOrCreateStudentConversation.useMutation();
  const uploadFileMutation = trpc.messaging.uploadFile.useMutation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = LOGIN_PATH;
    }
  }, [loading, isAuthenticated]);

  useEffect(() => {
    if (selectedConversationId) {
      markAsReadMutation.mutate({ conversationId: selectedConversationId });
    }
  }, [selectedConversationId]);

  const [conversationLoading, setConversationLoading] = useState(false);

  const handleTutorSelect = async (tutorId: number) => {
    if (!selectedStudentId || !user?.id) return;
    if (conversationLoading) return;

    setConversationLoading(true);
    setSelectedTutorId(tutorId);

    try {
      const conversation = await createConversationMutation.mutateAsync({
        parentId: user.id,
        tutorId: tutorId,
        studentId: selectedStudentId,
      });

      if (conversation) {
        const convId = typeof conversation === "number" ? conversation : conversation.id;
        setSelectedConversationId(convId);
        return;
      }

      // If no conversation returned, retry once
      const retry = await createConversationMutation.mutateAsync({
        parentId: user.id,
        tutorId: tutorId,
        studentId: selectedStudentId,
      });
      if (retry) {
        const convId = typeof retry === "number" ? retry : retry.id;
        setSelectedConversationId(convId);
      } else {
        toast.error("Failed to load conversation");
      }
    } catch (error) {
      console.error("Failed to load conversation", error);
      toast.error("Failed to load conversation");
    } finally {
      setConversationLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("File type not supported. Please upload images, PDFs, or documents.");
      return;
    }

    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleSendMessage = async () => {
    if ((!messageContent.trim() && !selectedFile) || !selectedConversationId) return;

    setUploading(true);
    try {
      let fileData = null;

      // Upload file if selected
      if (selectedFile) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data:image/png;base64, prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });

        fileData = await uploadFileMutation.mutateAsync({
          file: base64,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
        });
      }

      // Send message with or without file
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConversationId,
        content: messageContent.trim() || (fileData ? "Sent a file" : ""),
        fileUrl: fileData?.fileUrl,
        fileName: fileData?.fileName,
        fileType: fileData?.fileType,
        fileSize: fileData?.fileSize,
      });

      setMessageContent("");
      setSelectedFile(null);
      refetchMessages();
      toast.success("Message sent");
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setUploading(false);
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const selectedStudent = studentsWithTutors?.find(s => s.id === selectedStudentId);
  const selectedTutor = selectedStudent?.tutors.find((t: any) => t.id === selectedTutorId);

  const tutorListForUI = isTutor
    ? (tutorConversations || []).map((c: any) => ({
        conversationId: c.conversation.id,
        parentName: c.parent.name || c.parent.email || "Parent",
        studentName: (() => {
          const name = c.subscription
            ? `${c.subscription.studentFirstName || ""} ${c.subscription.studentLastName || ""}`.trim()
            : "";
          if (name) return name;
          if (c.course?.title) return c.course.title;
          return "Student";
        })(),
        courseTitle: c.course?.title || "Course",
        studentId: c.conversation.studentId,
      }))
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <div className="flex-1 container py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">
            {user?.role === "parent" 
              ? "Select a student to view their tutors and messages" 
              : "Communicate with parents"}
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6 h-[calc(100vh-16rem)]">
          {isParent ? (
            <>
              {/* Students List */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Students
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-20rem)]">
                    {studentsLoading ? (
                      <div className="p-4 space-y-4">
                        {[1, 2, 3].map(i => (
                          <Skeleton key={i} className="h-20 w-full" />
                        ))}
                      </div>
                    ) : studentsWithTutors && studentsWithTutors.length > 0 ? (
                      <div>
                        {studentsWithTutors.map((student) => (
                          <button
                            key={student.id}
                            onClick={() => {
                              setSelectedStudentId(student.id);
                              setSelectedTutorId(null);
                              setSelectedConversationId(null);
                            }}
                            className={`w-full p-4 text-left hover:bg-muted/50 transition-colors border-b border-border ${
                              selectedStudentId === student.id ? "bg-muted" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {student.firstName} {student.lastName}
                                </p>
                                {(() => {
                                  const courseNames = Array.from(
                                    new Set(
                                      (student.tutors || [])
                                        .map((t: any) => t.courseTitle)
                                        .filter(Boolean)
                                    )
                                  );
                                  if (courseNames.length === 0) return null;
                                  return (
                                    <Badge variant="secondary" className="text-xs mt-1 truncate max-w-[180px]">
                                      {courseNames.join(", ")}
                                    </Badge>
                                  );
                                })()}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {student.tutors.length} tutor{student.tutors.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No students enrolled yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enroll in a course to start messaging tutors
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Tutors List */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    Tutors
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-20rem)]">
                    {selectedStudent ? (
                      selectedStudent.tutors.length > 0 ? (
                        <div>
                          {selectedStudent.tutors.map((tutor: any) => (
                            <button
                              key={tutor.id}
                              onClick={() => handleTutorSelect(tutor.id)}
                              className={`w-full p-4 text-left hover:bg-muted/50 transition-colors border-b border-border ${
                                selectedTutorId === tutor.id ? "bg-muted" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                                  {tutor.name?.charAt(0) || "T"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{tutor.name || "Tutor"}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {tutor.courseTitle}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No tutors found</p>
                        </div>
                      )
                    ) : (
                      <div className="p-8 text-center">
                        <GraduationCap className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Select a student to view their tutors</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : (
            /* Tutor view: list conversations (parents/students) */
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Conversations
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-20rem)]">
                  {tutorConversationsLoading ? (
                    <div className="p-4 space-y-4">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                    </div>
                  ) : tutorListForUI.length > 0 ? (
                    <div>
                      {tutorListForUI.map((item) => (
                        <button
                          key={item.conversationId}
                          onClick={() => {
                            setSelectedConversationId(item.conversationId);
                            setSelectedStudentId(item.studentId || null);
                            setSelectedTutorId(null);
                          }}
                          className={`w-full p-4 text-left hover:bg-muted/50 transition-colors border-b border-border ${
                            selectedConversationId === item.conversationId ? "bg-muted" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                              {item.studentName?.charAt(0) || "S"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.studentName}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {item.courseTitle} · {item.parentName}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No conversations yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Parents will appear here once they message you.
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Messages Area */}
          <Card className="lg:col-span-2 flex flex-col h-[70vh]">
            {selectedConversationId && (selectedTutor || isTutor) ? (
              <>
                <CardHeader>
                  <CardTitle className="text-lg">
                    <div className="flex items-center gap-2">
                      <span>
                        Chat with{" "}
                        {isTutor
                          ? tutorListForUI.find((t) => t.conversationId === selectedConversationId)?.parentName || "Parent"
                          : selectedTutor?.name || "Tutor"}
                      </span>
                    </div>
                    <p className="text-sm font-normal text-muted-foreground mt-1">
                      {isTutor
                        ? tutorListForUI.find((t) => t.conversationId === selectedConversationId)?.studentName || "Student"
                        : `About ${selectedStudent?.firstName} ${selectedStudent?.lastName}`}
                    </p>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  <ScrollArea className="flex-1 p-4 overflow-auto">
                    {messagesLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <Skeleton key={i} className="h-20 w-3/4" />
                        ))}
                      </div>
                    ) : messages && messages.length > 0 ? (
                      <div className="space-y-4">
                        {messages.slice().reverse().map((msg) => {
                          const isOwn = msg.senderId === user?.id;
                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-lg p-3 break-words ${
                                  isOwn
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                }`}
                              >
                                {/* File attachment */}
                                {msg.fileUrl && (
                                  <div className="mb-2">
                                    {msg.fileType?.startsWith('image/') ? (
                                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                                        <img
                                          src={msg.fileUrl}
                                          alt={msg.fileName || 'Attachment'}
                                          className="rounded max-w-full h-auto max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        href={msg.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-2 p-2 rounded border ${
                                          isOwn
                                            ? "border-primary-foreground/20 hover:bg-primary-foreground/10"
                                            : "border-border hover:bg-accent"
                                        } transition-colors`}
                                      >
                                        <FileText className="w-4 h-4 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">{msg.fileName}</p>
                                          {msg.fileSize && (
                                            <p className={`text-xs ${
                                              isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                                            }`}>
                                              {(msg.fileSize / 1024).toFixed(1)} KB
                                            </p>
                                          )}
                                        </div>
                                      </a>
                                    )}
                                  </div>
                                )}
                                {msg.content && (
                                  <p className="text-sm whitespace-pre-wrap break-words break-all">{msg.content}</p>
                                )}
                                <p className={`text-xs mt-1 ${
                                  isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                                }`}>
                                  {new Date(msg.sentAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                      </div>
                    )}
                  </ScrollArea>

                  {/* Message Input */}
                  <div className="p-4 border-t border-border">
                    {selectedFile && (
                      <div className="mb-3 flex items-center gap-2 p-2 bg-muted rounded-lg">
                        {selectedFile.type.startsWith('image/') ? (
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={handleRemoveFile}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={uploading}
                      >
                        <Paperclip className="w-4 h-4" />
                      </Button>
                      <Input
                        placeholder="Type your message..."
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="flex-1"
                        disabled={uploading}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={(!messageContent.trim() && !selectedFile) || uploading}
                        size="icon"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Select a tutor to chat</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedStudent 
                      ? "Choose a tutor from the list to start messaging" 
                      : "Select a student first, then choose their tutor"}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
