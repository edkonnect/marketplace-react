import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, User, Paperclip, X, FileText, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { LOGIN_PATH } from "@/const";

export default function CoordinatorMessages() {
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");

  const { data: parentConversations, isLoading: conversationsLoading } = trpc.messaging.getCoordinatorParentConversations.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "coordinator", refetchInterval: 10000 }
  );

  const { data: messages, isLoading: messagesLoading, refetch: refetchMessages } = trpc.messaging.getMessages.useQuery(
    { conversationId: selectedConversationId! },
    {
      enabled: !!selectedConversationId,
      refetchInterval: 5000,
    }
  );

  const sendMessageMutation = trpc.messaging.sendMessage.useMutation();
  const markAsReadMutation = trpc.messaging.markAsRead.useMutation();
  const uploadFileMutation = trpc.messaging.uploadFile.useMutation();

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "coordinator")) {
      window.location.href = LOGIN_PATH;
    }
  }, [loading, isAuthenticated, user]);

  useEffect(() => {
    if (selectedConversationId) {
      markAsReadMutation.mutate(
        { conversationId: selectedConversationId },
        {
          onSuccess: () => {
            utils.messaging.getCoordinatorParentConversations.invalidate();
          },
        }
      );
    }
  }, [selectedConversationId]);

  // When new messages arrive (via polling) while conversation is open, mark as read immediately
  useEffect(() => {
    if (selectedConversationId && messages && messages.length > 0) {
      markAsReadMutation.mutate(
        { conversationId: selectedConversationId },
        {
          onSuccess: () => {
            utils.messaging.getCoordinatorParentConversations.invalidate();
          },
        }
      );
    }
  }, [messages]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, DOCX, and XLSX files are supported.");
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

      if (selectedFile) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
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
      utils.messaging.getCoordinatorParentConversations.invalidate();

      toast.success("Message sent");
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setUploading(false);
    }
  };

  if (loading || !isAuthenticated || user?.role !== "coordinator") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const searchTerm = globalSearch.trim().toLowerCase();
  const filteredConversations = (parentConversations || []).filter((conv: any) => {
    if (!searchTerm) return true;
    return (
      (conv.parentName || "").toLowerCase().includes(searchTerm) ||
      (conv.parentEmail || "").toLowerCase().includes(searchTerm)
    );
  });

  const selectedConversation = parentConversations?.find((c: any) => c.conversationId === selectedConversationId);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <div className="flex-1 container py-4 sm:py-6 mt-20">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Parent Messages</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Direct messages from parents you support
          </p>
        </div>

        <div className="mb-4">
          <Input
            placeholder="Search by parent name or email..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="text-sm"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 h-[calc(100vh-12rem)] sm:h-[calc(100vh-16rem)]">
          {/* Conversations List */}
          <Card className={`lg:col-span-1 ${selectedConversationId ? 'hidden lg:block' : ''}`}>
            <CardHeader className="py-3 sm:py-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                Conversations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-20rem)] sm:h-[calc(100vh-24rem)]">
                {conversationsLoading ? (
                  <div className="p-4 space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                  </div>
                ) : filteredConversations.length > 0 ? (
                  <div>
                    {filteredConversations.map((conv: any) => (
                      <button
                        key={conv.conversationId}
                        onClick={() => setSelectedConversationId(conv.conversationId)}
                        className={`w-full p-3 sm:p-4 text-left hover:bg-muted/50 transition-colors border-b border-border ${
                          selectedConversationId === conv.conversationId ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate">{conv.parentName}</p>
                              {conv.unreadCount > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {conv.unreadCount}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{conv.parentEmail}</p>
                            {conv.lastMessageAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(conv.lastMessageAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {searchTerm ? "No conversations match your search" : "No messages from parents yet"}
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Messages Area */}
          <Card className={`lg:col-span-3 flex flex-col h-[calc(100vh-16rem)] ${!selectedConversationId ? 'hidden lg:flex' : ''}`}>
            {selectedConversationId && selectedConversation ? (
              <>
                <CardHeader className="py-3 sm:py-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="lg:hidden"
                      onClick={() => setSelectedConversationId(null)}
                    >
                      ← Back
                    </Button>
                    <div className="flex-1">
                      <CardTitle className="text-base sm:text-lg">
                        Chat with {selectedConversation.parentName}
                      </CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        {selectedConversation.parentEmail}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                  <ScrollArea className="flex-1 p-3 sm:p-4 overflow-auto">
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
                                className={`max-w-[90%] sm:max-w-[75%] md:max-w-[70%] rounded-lg p-2.5 sm:p-3 ${
                                  isOwn
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                }`}
                              >
                                {msg.fileUrl && msg.fileName && (
                                  <div className={`mb-2 flex items-center gap-2 p-2 rounded border ${
                                    isOwn
                                      ? "border-primary-foreground/20"
                                      : "border-border"
                                  }`}>
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
                                    <button
                                      title="Download"
                                      onClick={() => {
                                        const a = document.createElement('a');
                                        a.href = msg.fileUrl!;
                                        a.download = msg.fileName!;
                                        a.click();
                                      }}
                                      className={`flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors`}
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                                {msg.content && (
                                  <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">{msg.content}</p>
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
                  <div className="p-3 sm:p-4 border-t border-border">
                    {selectedFile && (
                      <div className="mb-3 flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <FileText className="w-4 h-4 text-muted-foreground" />
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
                    <div className="flex gap-1.5 sm:gap-2">
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        onChange={handleFileSelect}
                        accept=".pdf,.docx,.xlsx"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={uploading}
                        className="h-9 w-9 sm:h-10 sm:w-10"
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
                        className="flex-1 text-sm"
                        disabled={uploading}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={(!messageContent.trim() && !selectedFile) || uploading}
                        size="icon"
                        className="h-9 w-9 sm:h-10 sm:w-10"
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
                  <p className="text-lg font-medium mb-2">Select a conversation</p>
                  <p className="text-sm text-muted-foreground">
                    Choose a parent from the list to start messaging
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
