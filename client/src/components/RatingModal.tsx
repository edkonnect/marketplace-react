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
      <DialogContent className="sm:max-w-[500px] max-w-[calc(100vw-2rem)] mx-4 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-lg sm:text-xl md:text-2xl">Give Feedback</DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base">
            How is your think of the session experience
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 sm:py-4 md:py-6">
          {/* Emoji Rating Selector */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 max-w-full">
            {ratingOptions.map((option) => (
              <button
                key={option.rating}
                type="button"
                onClick={() => setSelectedRating(option.rating)}
                className={`flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-2.5 md:p-3 rounded-xl transition-all hover:bg-accent/50 min-w-[70px] sm:min-w-[80px] md:min-w-[90px] ${
                  selectedRating === option.rating
                    ? "bg-primary/10 ring-2 ring-primary"
                    : ""
                }`}
              >
                <div
                  className={`text-2xl sm:text-3xl md:text-4xl transition-transform ${
                    selectedRating === option.rating ? "scale-105 sm:scale-110" : ""
                  }`}
                >
                  {option.emoji}
                </div>
                <span
                  className={`text-[10px] sm:text-xs md:text-sm font-medium whitespace-nowrap ${
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
            <Label htmlFor="rating-comment" className="text-xs sm:text-sm">
              What are the main reasons for your rating?
            </Label>
            <div className="relative">
              <div className="absolute left-3 top-3 text-muted-foreground">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="sm:w-5 sm:h-5"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <Textarea
                id="rating-comment"
                placeholder="Mention a reasons for your rating"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[80px] sm:min-h-[100px] pl-10 resize-none text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 w-full text-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedRating === null || isSubmitting}
            className="flex-1 w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
