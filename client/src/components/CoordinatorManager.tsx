import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Mail, Phone, Briefcase, Users, Trash2, Key } from "lucide-react";

export function CoordinatorManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    specialization: "",
    phoneNumber: "",
    bio: "",
  });
  const [assignForm, setAssignForm] = useState({
    parentId: "",
    notes: "",
  });

  const utils = trpc.useUtils();
  const { data: coordinators, isLoading: coordinatorsLoading } = trpc.coordinators.getAll.useQuery();
  const { data: assignments, isLoading: assignmentsLoading } = trpc.coordinators.getAllAssignments.useQuery();
  const { data: usersData } = trpc.admin.getAllUsers.useQuery({ limit: 1000, role: "parent" });
  const parents = usersData?.users || [];

  const createCoordinatorMutation = trpc.coordinators.create.useMutation({
    onSuccess: () => {
      toast.success("Coordinator created successfully");
      setIsCreateDialogOpen(false);
      setCreateForm({
        email: "",
        firstName: "",
        lastName: "",
        specialization: "",
        phoneNumber: "",
        bio: "",
      });
      utils.coordinators.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create coordinator");
    },
  });

  const assignCoordinatorMutation = trpc.coordinators.assignToParent.useMutation({
    onSuccess: () => {
      toast.success("Coordinator assigned successfully");
      setIsAssignDialogOpen(false);
      setSelectedCoordinatorId(null);
      setAssignForm({ parentId: "", notes: "" });
      utils.coordinators.getAllAssignments.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to assign coordinator");
    },
  });

  const removeAssignmentMutation = trpc.coordinators.removeAssignment.useMutation({
    onSuccess: () => {
      toast.success("Assignment removed successfully");
      utils.coordinators.getAllAssignments.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove assignment");
    },
  });

  const resendPasswordMutation = trpc.coordinators.resendPasswordSetup.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Password setup email sent!");
      } else {
        // Copy link to clipboard
        navigator.clipboard.writeText(data.setupLink);
        toast.success("Email failed. Setup link copied to clipboard!");
      }
      console.log("Password setup link:", data.setupLink);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to resend password setup");
    },
  });

  const handleCreateCoordinator = () => {
    if (!createForm.email || !createForm.firstName || !createForm.lastName) {
      toast.error("Please fill in all required fields");
      return;
    }
    createCoordinatorMutation.mutate(createForm);
  };

  const handleAssignCoordinator = () => {
    if (!selectedCoordinatorId || !assignForm.parentId) {
      toast.error("Please select both coordinator and parent");
      return;
    }
    assignCoordinatorMutation.mutate({
      coordinatorId: selectedCoordinatorId,
      parentId: parseInt(assignForm.parentId),
      notes: assignForm.notes,
    });
  };

  const handleRemoveAssignment = (assignmentId: number) => {
    if (confirm("Are you sure you want to remove this assignment?")) {
      removeAssignmentMutation.mutate({ assignmentId });
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Coordinator Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Coordinator Management
          </CardTitle>
          <CardDescription>
            Create and manage academic coordinators who assist parents with student progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Create New Coordinator
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Coordinator</DialogTitle>
                <DialogDescription>
                  Add a new academic coordinator to help parents manage their students. A password setup email will be sent to the coordinator's email address so they can log in.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={createForm.firstName}
                      onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={createForm.lastName}
                      onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="coordinator@edkonnect.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialization">Specialization</Label>
                  <Input
                    id="specialization"
                    value={createForm.specialization}
                    onChange={(e) => setCreateForm({ ...createForm, specialization: e.target.value })}
                    placeholder="K-12, College Prep, Special Education, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={createForm.phoneNumber}
                    onChange={(e) => setCreateForm({ ...createForm, phoneNumber: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={createForm.bio}
                    onChange={(e) => setCreateForm({ ...createForm, bio: e.target.value })}
                    placeholder="Brief description of background and expertise..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateCoordinator} disabled={createCoordinatorMutation.isPending}>
                  {createCoordinatorMutation.isPending ? "Creating..." : "Create Coordinator"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Coordinators List */}
      <Card>
        <CardHeader>
          <CardTitle>All Coordinators</CardTitle>
          <CardDescription>
            View and manage all academic coordinators
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coordinatorsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading coordinators...</div>
          ) : coordinators && coordinators.length > 0 ? (
            <div className="space-y-4">
              {coordinators.map((coordinator: any) => (
                <div key={coordinator.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">
                        {coordinator.firstName} {coordinator.lastName}
                      </h3>
                      <Badge variant="secondary">Coordinator</Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {coordinator.email}
                      </div>
                      {coordinator.phoneNumber && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {coordinator.phoneNumber}
                        </div>
                      )}
                      {coordinator.profile?.specialization && (
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          {coordinator.profile.specialization}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resendPasswordMutation.mutate({ coordinatorId: coordinator.id })}
                      disabled={resendPasswordMutation.isPending}
                    >
                      <Key className="mr-2 h-4 w-4" />
                      {resendPasswordMutation.isPending ? "Sending..." : "Send Password Link"}
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedCoordinatorId(coordinator.id);
                        setIsAssignDialogOpen(true);
                      }}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Assign to Parent
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No coordinators found. Create one to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Coordinator Assignments</CardTitle>
          <CardDescription>
            View and manage coordinator-parent assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading assignments...</div>
          ) : assignments && assignments.length > 0 ? (
            <div className="space-y-3">
              {assignments.map((assignment: any) => (
                <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">
                      {assignment.coordinator?.firstName} {assignment.coordinator?.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      assigned to {assignment.parent?.firstName} {assignment.parent?.lastName}
                    </div>
                    {assignment.notes && (
                      <div className="text-xs text-muted-foreground mt-1 italic">
                        "{assignment.notes}"
                      </div>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveAssignment(assignment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No assignments found. Assign coordinators to parents to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Coordinator Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Coordinator to Parent</DialogTitle>
            <DialogDescription>
              Select a parent to assign the coordinator to
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="parent">Parent</Label>
              <Select value={assignForm.parentId} onValueChange={(value) => setAssignForm({ ...assignForm, parentId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a parent" />
                </SelectTrigger>
                <SelectContent>
                  {parents.map((parent: any) => (
                    <SelectItem key={parent.id} value={parent.id.toString()}>
                      {parent.firstName} {parent.lastName} ({parent.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={assignForm.notes}
                onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                placeholder="Any special notes about this assignment..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignCoordinator} disabled={assignCoordinatorMutation.isPending}>
              {assignCoordinatorMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
