import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Mail, Phone, GraduationCap, DollarSign } from "lucide-react";
import { Pagination } from "@/components/Pagination";

export function RegisteredTutorsManager() {
  const [selectedTutor, setSelectedTutor] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const formatPrice = useFormatPrice();
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTutorIds, setSelectedTutorIds] = useState<number[]>([]);
  const ITEMS_PER_PAGE = 10;

  const { data: tutorsData, isLoading, refetch } = trpc.admin.getPendingTutors.useQuery({
    limit: ITEMS_PER_PAGE,
    offset: (currentPage - 1) * ITEMS_PER_PAGE,
  });

  const approveMutation = trpc.admin.approveTutor.useMutation({
    onSuccess: () => {
      toast.success("Tutor approved successfully!");
      refetch();
      setSelectedTutor(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to approve tutor");
    },
  });

  const rejectMutation = trpc.admin.rejectTutor.useMutation({
    onSuccess: () => {
      toast.success("Tutor application rejected");
      refetch();
      setSelectedTutor(null);
      setIsRejectDialogOpen(false);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reject tutor");
    },
  });

  const bulkApproveMutation = trpc.admin.bulkApproveTutors.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
      setSelectedTutorIds([]);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to bulk approve tutors");
    },
  });

  const handleApprove = (tutorId: number) => {
    approveMutation.mutate({ tutorId });
  };

  const handleReject = () => {
    if (!selectedTutor) return;
    
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    rejectMutation.mutate({
      tutorId: selectedTutor.id,
      reason: rejectionReason,
    });
  };

  const openRejectDialog = (tutor: any) => {
    setSelectedTutor(tutor);
    setIsRejectDialogOpen(true);
  };

  const toggleTutorSelection = (tutorId: number) => {
    setSelectedTutorIds(prev => 
      prev.includes(tutorId) 
        ? prev.filter(id => id !== tutorId)
        : [...prev, tutorId]
    );
  };

  const toggleSelectAll = (tutors: any[]) => {
    const pendingTutorIds = tutors.filter(t => t.approvalStatus === 'pending').map(t => t.id);
    if (selectedTutorIds.length === pendingTutorIds.length) {
      setSelectedTutorIds([]);
    } else {
      setSelectedTutorIds(pendingTutorIds);
    }
  };

  const handleBulkApprove = () => {
    if (selectedTutorIds.length === 0) {
      toast.error("Please select at least one tutor to approve");
      return;
    }
    bulkApproveMutation.mutate({ tutorIds: selectedTutorIds });
  };

  const parseJSON = (str: string | null) => {
    if (!str) return [];
    try {
      return JSON.parse(str);
    } catch {
      return [];
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registered Tutors</CardTitle>
          <CardDescription>Loading tutor applications...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const tutors = tutorsData?.tutors || [];
  const pendingTutors = tutors.filter((t: any) => t.approvalStatus === 'pending');
  const approvedTutors = tutors.filter((t: any) => t.approvalStatus === 'approved');
  const rejectedTutors = tutors.filter((t: any) => t.approvalStatus === 'rejected');

  // Find pending tutors whose name matches another pending tutor (possible duplicates)
  const pendingNameCounts: Record<string, number> = {};
  pendingTutors.forEach((t: any) => {
    const name = (t.userName || '').toLowerCase().trim();
    if (name) pendingNameCounts[name] = (pendingNameCounts[name] || 0) + 1;
  });
  const isDuplicateName = (tutor: any) => {
    const name = (tutor.userName || '').toLowerCase().trim();
    return name && pendingNameCounts[name] > 1;
  };

  return (
    <>
      <div className="space-y-6">
        {/* Pending Applications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Pending Applications
                </CardTitle>
                <CardDescription>
                  Review and approve or reject tutor applications
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {pendingTutors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTutorIds.length === pendingTutors.length && pendingTutors.length > 0}
                      onChange={() => toggleSelectAll(pendingTutors)}
                      className="w-4 h-4 rounded border-input"
                    />
                    <span className="text-sm text-muted-foreground">Select All</span>
                  </div>
                )}
                {selectedTutorIds.length > 0 && (
                  <Button
                    onClick={handleBulkApprove}
                    disabled={bulkApproveMutation.isPending}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve Selected ({selectedTutorIds.length})
                  </Button>
                )}
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {pendingTutors.length}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pendingTutors.length > 0 ? (
              <div className="space-y-4">
                {pendingTutors.map((tutor: any) => {
                  const subjects = parseJSON(tutor.subjects);
                  const gradeLevels = parseJSON(tutor.gradeLevels);
                  
                  return (
                    <Card key={tutor.id} className={`border-2 ${isDuplicateName(tutor) ? 'border-orange-400 bg-orange-50/50' : 'border-yellow-200 bg-yellow-50/50'}`}>
                      <CardContent className="pt-6">
                        {isDuplicateName(tutor) && (
                          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-orange-100 border border-orange-300 rounded-md text-orange-800 text-sm font-medium">
                            ⚠️ Possible duplicate — another pending application exists with the same name
                          </div>
                        )}
                        <div className="flex gap-4">
                          <div className="flex items-start pt-1">
                            <input
                              type="checkbox"
                              checked={selectedTutorIds.includes(tutor.id)}
                              onChange={() => toggleTutorSelection(tutor.id)}
                              className="w-4 h-4 rounded border-input"
                            />
                          </div>
                          <Avatar className="h-16 w-16 flex-shrink-0">
                            <AvatarImage src={tutor.profileImageUrl || undefined} alt={tutor.userName || 'Tutor'} />
                            <AvatarFallback className="text-lg">
                              {tutor.userName?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'T'}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 space-y-3">
                            <div>
                              <h3 className="font-semibold text-lg">{tutor.userName}</h3>
                              <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                                {tutor.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="w-4 h-4" />
                                    {tutor.email}
                                  </div>
                                )}
                                {tutor.yearsOfExperience && (
                                  <div className="flex items-center gap-1">
                                    <GraduationCap className="w-4 h-4" />
                                    {tutor.yearsOfExperience} years experience
                                  </div>
                                )}
                                {tutor.hourlyRate && (
                                  <div className="flex items-center gap-1">
                                    <DollarSign className="w-4 h-4" />
                                    {formatPrice(tutor.hourlyRate, "/hour")}
                                  </div>
                                )}
                              </div>
                            </div>

                            {tutor.bio && (
                              <div>
                                <p className="text-sm font-medium mb-1">About:</p>
                                <p className="text-sm text-muted-foreground">{tutor.bio}</p>
                              </div>
                            )}

                            {tutor.qualifications && (
                              <div>
                                <p className="text-sm font-medium mb-1">Qualifications:</p>
                                <p className="text-sm text-muted-foreground">{tutor.qualifications}</p>
                              </div>
                            )}

                            {subjects.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-2">Subjects:</p>
                                <div className="flex flex-wrap gap-2">
                                  {subjects.map((subject: string, idx: number) => (
                                    <Badge key={idx} variant="secondary">{subject}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {gradeLevels.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-2">Grade Levels:</p>
                                <div className="flex flex-wrap gap-2">
                                  {gradeLevels.map((level: string, idx: number) => (
                                    <Badge key={idx} variant="outline">{level}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2 pt-2">
                              <Button
                                onClick={() => handleApprove(tutor.id)}
                                disabled={approveMutation.isPending}
                                className="flex-1"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => openRejectDialog(tutor)}
                                disabled={rejectMutation.isPending}
                                className="flex-1"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No pending applications</p>
            )}
          </CardContent>
        </Card>

        {/* Approved Tutors */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Approved Tutors
                </CardTitle>
                <CardDescription>
                  Tutors who have been approved and are visible on the platform
                </CardDescription>
              </div>
              <Badge variant="default" className="text-lg px-3 py-1">
                {approvedTutors.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {approvedTutors.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {approvedTutors.map((tutor: any) => (
                  <div key={tutor.id} className="p-4 border rounded-lg flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={tutor.profileImageUrl || undefined} alt={tutor.userName || 'Tutor'} />
                      <AvatarFallback>
                        {tutor.userName?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'T'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{tutor.userName}</p>
                      <p className="text-sm text-muted-foreground">{tutor.email}</p>
                    </div>
                    <Badge variant="default">Approved</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No approved tutors</p>
            )}
          </CardContent>
        </Card>

        {/* Rejected Applications */}
        {rejectedTutors.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    Rejected Applications
                  </CardTitle>
                  <CardDescription>
                    Applications that were not approved
                  </CardDescription>
                </div>
                <Badge variant="destructive" className="text-lg px-3 py-1">
                  {rejectedTutors.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {rejectedTutors.map((tutor: any) => (
                  <div key={tutor.id} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={tutor.profileImageUrl || undefined} alt={tutor.userName || 'Tutor'} />
                        <AvatarFallback className="text-sm">
                          {tutor.userName?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'T'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{tutor.userName}</p>
                        <p className="text-sm text-muted-foreground">{tutor.email}</p>
                      </div>
                      <Badge variant="destructive">Rejected</Badge>
                    </div>
                    {tutor.rejectionReason && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        <p className="font-medium mb-1">Reason:</p>
                        <p className="text-muted-foreground">{tutor.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {tutorsData && tutorsData.total > ITEMS_PER_PAGE && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalItems={tutorsData.total}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Rejection Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Tutor Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this application. This will be sent to the applicant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason *</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please explain why this application is being rejected..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
            >
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
