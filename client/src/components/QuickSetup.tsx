import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  AlertCircle, CheckCircle2, Zap, Save, Trash2, Copy, 
  Filter, X, ArrowRight, Loader2, Download, Upload 
} from "lucide-react";

export function QuickSetup() {
  const adminTrpc = trpc.admin as any;
  // State
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const [filterSubject, setFilterSubject] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [conflictResolution, setConflictResolution] = useState<'skip' | 'rename' | 'overwrite'>('rename');
  
  // Template creation state
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [newTemplateAppointmentType, setNewTemplateAppointmentType] = useState("");
  const [newTemplateCalendar, setNewTemplateCalendar] = useState("");

  // Queries
  const { data: courses, isLoading: coursesLoading } = trpc.course.list.useQuery();
  const { data: templates, isLoading: templatesLoading, refetch: refetchTemplates } = 
    adminTrpc.getAllMappingTemplates.useQuery();
  const { data: appointmentTypes, isLoading: appointmentTypesLoading } = 
    adminTrpc.getAcuityAppointmentTypes.useQuery();
  const { data: calendars, isLoading: calendarsLoading } = 
    adminTrpc.getAcuityCalendars.useQuery();

  // Mutations
  const createTemplateMutation = adminTrpc.createMappingTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template created successfully");
      refetchTemplates();
      setShowTemplateDialog(false);
      resetTemplateForm();
    },
    onError: (error: any) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });

  const deleteTemplateMutation = adminTrpc.deleteMappingTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template deleted successfully");
      refetchTemplates();
      setSelectedTemplate(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });

  const bulkApplyMutation = adminTrpc.bulkApplyMapping.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Successfully mapped ${data.count} courses`);
      setSelectedCourses([]);
      setShowPreview(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to apply mapping: ${error.message}`);
    },
  });

  const exportTemplatesMutation = adminTrpc.exportTemplates.useQuery(
    { templateIds: undefined },
    { enabled: false }
  );

  const importTemplatesMutation = adminTrpc.importTemplates.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Imported ${data.imported} templates. Skipped: ${data.skipped}`);
      if (data.errors.length > 0) {
        data.errors.forEach((err: any) => toast.error(err));
      }
      refetchTemplates();
      setShowImportDialog(false);
      setImportFile(null);
      setImportPreview(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to import templates: ${error.message}`);
    },
  });

  // Filter courses
  const filteredCourses = courses?.filter((course) => {
    const matchesSubject = !filterSubject || course.subject === filterSubject;
    const matchesSearch = !filterSearch || 
      course.title.toLowerCase().includes(filterSearch.toLowerCase());
    return matchesSubject && matchesSearch;
  }) || [];

  // Get unique subjects
  const subjects = Array.from(new Set(courses?.map(c => c.subject) || []));

  // Get selected template data
  const currentTemplate = templates?.find((t: any) => t.id === selectedTemplate);

  // Handlers
  const handleCourseToggle = (courseId: number) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCourses.length === filteredCourses.length) {
      setSelectedCourses([]);
    } else {
      setSelectedCourses(filteredCourses.map(c => c.id));
    }
  };

  const handleCreateTemplate = () => {
    if (!newTemplateName || !newTemplateAppointmentType || !newTemplateCalendar) {
      toast.error("Please fill in all required fields");
      return;
    }

    createTemplateMutation.mutate({
      name: newTemplateName,
      description: newTemplateDescription,
      acuityAppointmentTypeId: parseInt(newTemplateAppointmentType),
      acuityCalendarId: parseInt(newTemplateCalendar),
    });
  };

  const handleDeleteTemplate = (templateId: number) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplateMutation.mutate({ id: templateId });
    }
  };

  const handleDuplicateTemplate = (template: any) => {
    setNewTemplateName(`${template.name} (Copy)`);
    setNewTemplateDescription(template.description || "");
    setNewTemplateAppointmentType(template.acuityAppointmentTypeId.toString());
    setNewTemplateCalendar(template.acuityCalendarId.toString());
    setShowTemplateDialog(true);
  };

  const handleApplyMapping = () => {
    if (!currentTemplate) {
      toast.error("Please select a template");
      return;
    }

    bulkApplyMutation.mutate({
      courseIds: selectedCourses,
      acuityAppointmentTypeId: currentTemplate.acuityAppointmentTypeId,
      acuityCalendarId: currentTemplate.acuityCalendarId,
    });
  };

  const handleExportTemplate = async (templateId: number) => {
    try {
      const response = await fetch(`/api/trpc/admin.exportTemplates?input=${encodeURIComponent(JSON.stringify({ templateIds: [templateId] }))}`);
      const data = await response.json();
      
      const blob = new Blob([JSON.stringify(data.result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template-${templateId}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Template exported successfully");
    } catch (error) {
      toast.error("Failed to export template");
    }
  };

  const handleExportAll = async () => {
    try {
      const response = await fetch(`/api/trpc/admin.exportTemplates?input=${encodeURIComponent(JSON.stringify({}))}`);
      const data = await response.json();
      
      const blob = new Blob([JSON.stringify(data.result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all-templates-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("All templates exported successfully");
    } catch (error) {
      toast.error("Failed to export templates");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setImportPreview(json);
      } catch (error) {
        toast.error("Invalid JSON file");
        setImportFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!importPreview || !importPreview.templates) {
      toast.error("No valid templates to import");
      return;
    }

    importTemplatesMutation.mutate({
      templates: importPreview.templates,
      conflictResolution,
    });
  };

  const resetTemplateForm = () => {
    setNewTemplateName("");
    setNewTemplateDescription("");
    setNewTemplateAppointmentType("");
    setNewTemplateCalendar("");
  };

  if (coursesLoading || templatesLoading || appointmentTypesLoading || calendarsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Zap className="h-4 w-4" />
        <AlertDescription>
          Quick Setup allows you to map multiple courses to Acuity appointment types and calendars at once using templates. Select courses, choose a template, and apply in bulk.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="apply" className="space-y-4">
        <TabsList>
          <TabsTrigger value="apply">Apply Template</TabsTrigger>
          <TabsTrigger value="manage">Manage Templates</TabsTrigger>
        </TabsList>

        {/* Apply Template Tab */}
        <TabsContent value="apply" className="space-y-6">
          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Select Template</CardTitle>
              <CardDescription>
                Choose a mapping template to apply to selected courses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select 
                  value={selectedTemplate?.toString() || ""} 
                  onValueChange={(value) => setSelectedTemplate(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template: any) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentTemplate && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium">{currentTemplate.name}</p>
                  {currentTemplate.description && (
                    <p className="text-xs text-muted-foreground">{currentTemplate.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      Appointment Type: {
                        appointmentTypes?.find((t: any) => t.id === currentTemplate.acuityAppointmentTypeId)?.name || "Unknown"
                      }
                    </div>
                    <div>
                      Calendar: {
                        calendars?.find((c: any) => c.id === currentTemplate.acuityCalendarId)?.name || "Unknown"
                      }
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Course Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Select Courses</CardTitle>
              <CardDescription>
                Choose which courses to apply the template to
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search courses..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                  />
                </div>
                <Select value={filterSubject} onValueChange={setFilterSubject}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(filterSearch || filterSubject) && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setFilterSearch("");
                      setFilterSubject("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Select All */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedCourses.length === filteredCourses.length && filteredCourses.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label>Select All ({filteredCourses.length} courses)</Label>
                </div>
                <Badge variant="secondary">
                  {selectedCourses.length} selected
                </Badge>
              </div>

              {/* Course List */}
              <div className="max-h-96 overflow-y-auto space-y-2 border rounded-lg p-4">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedCourses.includes(course.id)}
                      onCheckedChange={() => handleCourseToggle(course.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{course.title}</p>
                      <p className="text-xs text-muted-foreground">{course.subject}</p>
                    </div>
                    {(course as any).acuityAppointmentTypeId && (course as any).acuityCalendarId && (
                      <Badge variant="outline" className="text-xs">
                        Already Mapped
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Apply Button */}
          <div className="flex justify-end gap-4">
            <Button
              onClick={() => setShowPreview(true)}
              disabled={!currentTemplate || selectedCourses.length === 0}
              size="lg"
            >
              Preview & Apply
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </TabsContent>

        {/* Manage Templates Tab */}
        <TabsContent value="manage" className="space-y-6">
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportAll}>
                <Download className="mr-2 h-4 w-4" />
                Export All
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
            </div>
            <Button onClick={() => setShowTemplateDialog(true)}>
              <Save className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>

          <div className="grid gap-4">
            {templates?.map((template: any) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{template.name}</CardTitle>
                      {template.description && (
                        <CardDescription>{template.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleExportTemplate(template.id)}
                        title="Export template"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDuplicateTemplate(template)}
                        title="Duplicate template"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDeleteTemplate(template.id)}
                        title="Delete template"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">Appointment Type:</span>{" "}
                      {appointmentTypes?.find((t: any) => t.id === template.acuityAppointmentTypeId)?.name || "Unknown"}
                    </div>
                    <div>
                      <span className="font-medium">Calendar:</span>{" "}
                      {calendars?.find((c: any) => c.id === template.acuityCalendarId)?.name || "Unknown"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(template.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Bulk Mapping</DialogTitle>
            <DialogDescription>
              Review the changes before applying them to {selectedCourses.length} courses
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Template: {currentTemplate?.name}</p>
              <div className="text-sm space-y-1">
                <div>
                  Appointment Type: {
                    appointmentTypes?.find((t: any) => t.id === currentTemplate?.acuityAppointmentTypeId)?.name
                  }
                </div>
                <div>
                  Calendar: {
                    calendars?.find((c: any) => c.id === currentTemplate?.acuityCalendarId)?.name
                  }
                </div>
              </div>
            </div>

            <div>
              <p className="font-medium mb-2">Courses to be mapped ({selectedCourses.length}):</p>
              <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-4">
                {courses?.filter(c => selectedCourses.includes(c.id)).map((course) => (
                  <div key={course.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>{course.title}</span>
                    {(course as any).acuityAppointmentTypeId && (
                      <Badge variant="outline" className="text-xs">
                        Will overwrite existing mapping
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleApplyMapping}
              disabled={bulkApplyMutation.isPending}
            >
              {bulkApplyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Mapping Template</DialogTitle>
            <DialogDescription>
              Save a reusable template for bulk course mapping
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g., Math Courses - John's Calendar"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description..."
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Appointment Type *</Label>
              <Select 
                value={newTemplateAppointmentType} 
                onValueChange={setNewTemplateAppointmentType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select appointment type" />
                </SelectTrigger>
                <SelectContent>
                  {appointmentTypes?.map((type: any) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name} ({type.duration} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Calendar *</Label>
              <Select 
                value={newTemplateCalendar} 
                onValueChange={setNewTemplateCalendar}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select calendar" />
                </SelectTrigger>
                <SelectContent>
                  {calendars?.map((calendar: any) => (
                    <SelectItem key={calendar.id} value={calendar.id.toString()}>
                      {calendar.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowTemplateDialog(false);
                resetTemplateForm();
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTemplate}
              disabled={createTemplateMutation.isPending}
            >
              {createTemplateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Templates</DialogTitle>
            <DialogDescription>
              Upload a JSON file containing template definitions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Upload JSON File</Label>
              <Input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="mt-2"
              />
            </div>

            {importPreview && (
              <>
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
                    <div className="text-sm space-y-2">
                      <div>
                        <span className="font-medium">Version:</span> {importPreview.version}
                      </div>
                      <div>
                        <span className="font-medium">Export Date:</span>{" "}
                        {new Date(importPreview.exportDate).toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Templates:</span> {importPreview.templates?.length || 0}
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {importPreview.templates?.map((t: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 bg-muted rounded">
                          <div className="font-medium">{t.name}</div>
                          {t.description && (
                            <div className="text-muted-foreground text-xs">{t.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Conflict Resolution</Label>
                  <Select value={conflictResolution} onValueChange={(v: any) => setConflictResolution(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rename">Rename (add suffix)</SelectItem>
                      <SelectItem value="skip">Skip existing</SelectItem>
                      <SelectItem value="overwrite">Overwrite existing</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {conflictResolution === 'rename' && "Templates with duplicate names will be renamed with a suffix"}
                    {conflictResolution === 'skip' && "Templates with duplicate names will be skipped"}
                    {conflictResolution === 'overwrite' && "Existing templates with the same name will be replaced"}
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowImportDialog(false);
                setImportFile(null);
                setImportPreview(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!importPreview || importTemplatesMutation.isPending}
            >
              {importTemplatesMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import Templates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
