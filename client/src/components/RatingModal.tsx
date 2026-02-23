import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface RatingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
  isSubmitting?: boolean;
}

const ratingOptions = [
  {
    rating: 1,
    emoji: "😢",
    label: "Poor",
    description: "Not satisfied with the session",
  },
  {
    rating: 2,
    emoji: "😕",
    label: "Average",
    description: "Session was okay",
  },
  {
    rating: 3,
    emoji: "😊",
    label: "Good",
    description: "Enjoyed the session",
  },
  {
    rating: 4,
    emoji: "😃",
    label: "Great",
    description: "Great learning experience",
  },
  {
    rating: 5,
    emoji: "😍",
    label: "Excellent",
    description: "Outstanding session!",
  },
];

export function RatingModal({ open, onClose, onSubmit, isSubmitting }: RatingModalProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    if (selectedRating === null) return;
    onSubmit(selectedRating, comment);
  };

  const handleClose = () => {
    setSelectedRating(null);
    setComment("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-w-[95vw] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-center text-xl sm:text-2xl">Give Feedback</DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base">
            How is your think of the session experience
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 sm:py-6">
          {/* Emoji Rating Selector */}
          <div className="flex justify-center gap-1 sm:gap-3 mb-4 sm:mb-6">
            {ratingOptions.map((option) => (
              <button
                key={option.rating}
                type="button"
                onClick={() => setSelectedRating(option.rating)}
                className={`flex flex-col items-center gap-1 sm:gap-2 p-1.5 sm:p-3 rounded-xl transition-all hover:bg-accent/50 ${
                  selectedRating === option.rating
                    ? "bg-primary/10 ring-2 ring-primary"
                    : ""
                }`}
              >
                <div
                  className={`text-3xl sm:text-5xl transition-transform ${
                    selectedRating === option.rating ? "scale-110" : ""
                  }`}
                >
                  {option.emoji}
                </div>
                <span
                  className={`text-xs sm:text-sm font-medium ${
                    selectedRating === option.rating
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>

          {/* Comment Section */}
          <div className="space-y-2">
            <Label htmlFor="rating-comment" className="text-sm">
              What are the main reasons for your rating?
            </Label>
            <div className="relative">
              <div className="absolute left-3 top-3 text-muted-foreground">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <Textarea
                id="rating-comment"
                placeholder="Mention a reasons for your rating"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[80px] sm:min-h-[100px] pl-10 resize-none text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 w-full"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedRating === null || isSubmitting}
            className="flex-1 w-full bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:hover:bg-gray-200 dark:text-gray-900"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
