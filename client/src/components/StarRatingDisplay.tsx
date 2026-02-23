interface StarRatingDisplayProps {
  rating: number; // 1-5
  comment?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const ratingConfig = {
  1: { emoji: "😢", label: "Poor", color: "text-red-500" },
  2: { emoji: "😕", label: "Average", color: "text-orange-500" },
  3: { emoji: "😊", label: "Good", color: "text-yellow-500" },
  4: { emoji: "😃", label: "Great", color: "text-blue-500" },
  5: { emoji: "😍", label: "Excellent", color: "text-green-500" },
};

const sizeConfig = {
  sm: {
    emoji: "text-xl",
    label: "text-xs",
    container: "gap-1.5",
  },
  md: {
    emoji: "text-3xl",
    label: "text-sm",
    container: "gap-2",
  },
  lg: {
    emoji: "text-5xl",
    label: "text-base",
    container: "gap-3",
  },
};

export function StarRatingDisplay({
  rating,
  comment,
  size = "md",
  showLabel = true,
}: StarRatingDisplayProps) {
  const config = ratingConfig[rating as keyof typeof ratingConfig];
  const sizes = sizeConfig[size];

  if (!config) return null;

  // Generate star icons based on rating
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);

  return (
    <div className={size === "sm" ? "space-y-1.5" : "space-y-2"}>
      <div className={`flex items-center ${sizes.container}`}>
        {/* Emoji */}
        <span className={sizes.emoji}>{config.emoji}</span>

        {/* Stars */}
        <div className="flex items-center gap-0.5">
          {stars.map((star) => (
            <svg
              key={star}
              className={`${
                size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5"
              } ${star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 fill-gray-300"}`}
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ))}
        </div>

        {/* Label */}
        {showLabel && (
          <span className={`${sizes.label} font-medium ${config.color}`}>
            {config.label}
          </span>
        )}
      </div>

      {/* Comment */}
      {comment && (
        <div className={`bg-muted/50 rounded-lg border border-border ${
          size === "sm" ? "p-2" : "p-3"
        }`}>
          <p className={`${
            size === "sm" ? "text-xs" : "text-sm"
          } text-muted-foreground italic line-clamp-2`}>
            "{comment}"
          </p>
        </div>
      )}
    </div>
  );
}
