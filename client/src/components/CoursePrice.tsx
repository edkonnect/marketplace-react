interface CoursePriceProps {
  price: string | number;
  className?: string;
  priceClassName?: string;
}

export function CoursePrice({ price, className = "", priceClassName = "" }: CoursePriceProps) {
  return (
    <div className={`text-right ${className}`}>
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-none mb-0.5">
        as low as
      </div>
      <div className={priceClassName}>
        ${typeof price === "string" ? parseFloat(price) : price}
      </div>
    </div>
  );
}
