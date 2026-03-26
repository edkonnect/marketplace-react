import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Pencil, Trash2, Plus, Upload, Star, User } from "lucide-react";
import { ImageCropModal } from "@/components/ImageCropModal";

type Testimonial = {
  id: number;
  parentName: string;
  parentInitials: string;
  parentRole: string | null;
  parentImage: string | null;
  content: string;
  rating: number;
  displayOrder: number;
  isActive: boolean;
};

type FormValues = {
  parentName: string;
  parentInitials: string;
  parentRole: string;
  content: string;
  rating: string;
  displayOrder: string;
  isActive: boolean;
  parentImage: string;
};

const emptyForm: FormValues = {
  parentName: "",
  parentInitials: "",
  parentRole: "",
  content: "",
  rating: "5",
  displayOrder: "0",
  isActive: true,
  parentImage: "",
};

function deriveInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function TestimonialsManager() {
  const { data: testimonials = [], refetch } = trpc.adminTestimonials.getAll.useQuery();
  const createMutation = trpc.adminTestimonials.create.useMutation({
    onSuccess: () => { toast.success("Testimonial added"); refetch(); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.adminTestimonials.update.useMutation({
    onSuccess: () => { toast.success("Testimonial updated"); refetch(); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.adminTestimonials.delete.useMutation({
    onSuccess: () => { toast.success("Testimonial deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const uploadImageMutation = trpc.adminTestimonials.uploadImage.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, displayOrder: String(testimonials.length + 1) });
    setDialogOpen(true);
  };

  const openEdit = (t: Testimonial) => {
    setEditing(t);
    setForm({
      parentName: t.parentName,
      parentInitials: t.parentInitials,
      parentRole: t.parentRole ?? "",
      content: t.content,
      rating: String(t.rating),
      displayOrder: String(t.displayOrder),
      isActive: t.isActive,
      parentImage: t.parentImage ?? "",
    });
    setDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      parentName: name,
      parentInitials: prev.parentInitials || deriveInitials(name),
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropConfirm = async (dataUrl: string, blob: Blob) => {
    setCropSrc(null);
    setUploading(true);
    try {
      const base64Data = dataUrl.split(",")[1];
      const result = await uploadImageMutation.mutateAsync({
        fileName: "photo.jpg",
        fileType: blob.type || "image/jpeg",
        fileSize: blob.size,
        base64Data,
      });
      setForm((prev) => ({ ...prev, parentImage: result.imageUrl }));
      toast.success("Photo uploaded");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!form.parentName.trim()) { toast.error("Name is required"); return; }
    if (!form.parentInitials.trim()) { toast.error("Initials are required"); return; }
    if (!form.content.trim()) { toast.error("Review content is required"); return; }

    const payload = {
      parentName: form.parentName.trim(),
      parentInitials: form.parentInitials.trim().toUpperCase().slice(0, 5),
      parentRole: form.parentRole.trim() || undefined,
      parentImage: form.parentImage.trim() || undefined,
      content: form.content.trim(),
      rating: Number(form.rating),
      displayOrder: Number(form.displayOrder),
      isActive: form.isActive,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (t: Testimonial) => {
    if (!confirm(`Delete testimonial from ${t.parentName}?`)) return;
    deleteMutation.mutate({ id: t.id });
  };

  const handleToggleActive = (t: Testimonial) => {
    updateMutation.mutate({ id: t.id, isActive: !t.isActive });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Testimonials</CardTitle>
            <CardDescription>Manage parent reviews shown on the homepage.</CardDescription>
          </div>
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Testimonial
          </Button>
        </CardHeader>
        <CardContent>
          {testimonials.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No testimonials yet.</p>
          ) : (
            <div className="divide-y">
              {/* Header row */}
              <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground pb-2">
                <div className="col-span-1">Photo</div>
                <div className="col-span-3">Parent</div>
                <div className="col-span-4">Review</div>
                <div className="col-span-1 text-center">Rating</div>
                <div className="col-span-1 text-center">Order</div>
                <div className="col-span-1 text-center">Active</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {(testimonials as Testimonial[]).map((t) => (
                <div key={t.id} className="grid grid-cols-12 items-center gap-2 py-3">
                  {/* Photo */}
                  <div className="col-span-1">
                    {t.parentImage ? (
                      <img
                        src={t.parentImage}
                        alt={t.parentName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                        {t.parentInitials}
                      </div>
                    )}
                  </div>

                  {/* Name + role */}
                  <div className="col-span-3">
                    <p className="font-medium text-sm">{t.parentName}</p>
                    {t.parentRole && (
                      <p className="text-xs text-muted-foreground">{t.parentRole}</p>
                    )}
                  </div>

                  {/* Content preview */}
                  <div className="col-span-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">{t.content}</p>
                  </div>

                  {/* Rating */}
                  <div className="col-span-1 flex justify-center gap-0.5">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  {/* Order */}
                  <div className="col-span-1 text-center text-sm text-muted-foreground">
                    {t.displayOrder}
                  </div>

                  {/* Active toggle */}
                  <div className="col-span-1 flex justify-center">
                    <Switch
                      checked={t.isActive}
                      onCheckedChange={() => handleToggleActive(t)}
                      disabled={updateMutation.isPending}
                    />
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(t)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Photo upload */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {form.parentImage ? (
                  <img src={form.parentImage} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  {uploading ? "Uploading…" : "Upload Photo"}
                </Button>
                {form.parentImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground text-xs"
                    onClick={() => setForm((prev) => ({ ...prev, parentImage: "" }))}
                  >
                    Remove photo
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">JPG or PNG, max 500KB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Name + Initials */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Parent Name <span className="text-destructive">*</span></Label>
                <Input
                  value={form.parentName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Sarah Thompson"
                />
              </div>
              <div className="space-y-1">
                <Label>Initials <span className="text-destructive">*</span></Label>
                <Input
                  value={form.parentInitials}
                  onChange={(e) => setForm((prev) => ({ ...prev, parentInitials: e.target.value.toUpperCase().slice(0, 5) }))}
                  placeholder="ST"
                  maxLength={5}
                />
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1">
              <Label>Parent Role</Label>
              <Input
                value={form.parentRole}
                onChange={(e) => setForm((prev) => ({ ...prev, parentRole: e.target.value }))}
                placeholder="Parent of Year 9 student"
              />
            </div>

            {/* Review */}
            <div className="space-y-1">
              <Label>Review <span className="text-destructive">*</span></Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Write the parent's review here…"
                rows={4}
              />
            </div>

            {/* Rating + Order + Active */}
            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <Label>Rating</Label>
                <Select
                  value={form.rating}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, rating: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 4, 3, 2, 1].map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {r} {r === 1 ? "star" : "stars"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) => setForm((prev) => ({ ...prev, displayOrder: e.target.value }))}
                  min={0}
                />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((prev) => ({ ...prev, isActive: v }))}
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Saving…" : editing ? "Save Changes" : "Add Testimonial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image crop modal */}
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}
