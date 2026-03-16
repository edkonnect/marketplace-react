interface CoursePriceProps {
  price: string | number;
  className?: string;
  priceClassName?: string;
}

export function CoursePrice({ price, className = "", priceClassName = "" }: CoursePriceProps) {
  return (
    <div className={`flex items-baseline gap-1 ${className}`}>
      <span className="text-xs text-muted-foreground font-normal">from</span>
      <span className={priceClassName}>
        ${typeof price === "string" ? parseFloat(price) : price}
      </span>
    </div>
  );
}
