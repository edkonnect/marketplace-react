import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-gradient-to-r group-[.toaster]:from-white/92 group-[.toaster]:via-primary/8 group-[.toaster]:to-white/92 group-[.toaster]:backdrop-blur-lg group-[.toaster]:text-gray-800 group-[.toaster]:border group-[.toaster]:border-primary/25 group-[.toaster]:shadow-xl group-[.toaster]:shadow-primary/10 group-[.toaster]:rounded-2xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:hover:bg-primary/90 group-[.toast]:rounded-lg group-[.toast]:transition-colors",
          cancelButton: "group-[.toast]:bg-white/60 group-[.toast]:text-gray-700 group-[.toast]:hover:bg-white/80 group-[.toast]:border group-[.toast]:border-primary/20 group-[.toast]:rounded-lg group-[.toast]:backdrop-blur-sm group-[.toast]:transition-colors",
          success: "group-[.toast]:bg-gradient-to-r group-[.toast]:from-green-50/95 group-[.toast]:via-emerald-50/90 group-[.toast]:to-green-50/95 group-[.toast]:backdrop-blur-lg group-[.toast]:border-green-300/40 group-[.toast]:text-green-800 group-[.toast]:shadow-green-200/20",
          error: "group-[.toast]:bg-gradient-to-r group-[.toast]:from-red-50/95 group-[.toast]:via-rose-50/90 group-[.toast]:to-red-50/95 group-[.toast]:backdrop-blur-lg group-[.toast]:border-red-300/40 group-[.toast]:text-red-800 group-[.toast]:shadow-red-200/20",
          warning: "group-[.toast]:bg-gradient-to-r group-[.toast]:from-amber-50/95 group-[.toast]:via-yellow-50/90 group-[.toast]:to-amber-50/95 group-[.toast]:backdrop-blur-lg group-[.toast]:border-amber-300/40 group-[.toast]:text-amber-800 group-[.toast]:shadow-amber-200/20",
          info: "group-[.toast]:bg-gradient-to-r group-[.toast]:from-blue-50/95 group-[.toast]:via-sky-50/90 group-[.toast]:to-blue-50/95 group-[.toast]:backdrop-blur-lg group-[.toast]:border-blue-300/40 group-[.toast]:text-blue-800 group-[.toast]:shadow-blue-200/20",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      richColors
      expand={false}
      duration={4000}
      {...props}
    />
  );
};

export { Toaster };
