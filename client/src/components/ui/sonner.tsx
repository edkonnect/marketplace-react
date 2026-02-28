import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "!bg-gradient-to-r !from-white/95 !via-blue-50/30 !to-white/95 !backdrop-blur-lg !text-gray-800 !border !border-blue-200/50 !shadow-xl !shadow-blue-100/50 !rounded-2xl",
          description: "!text-gray-600",
          actionButton: "!bg-blue-600 !text-white hover:!bg-blue-700 !rounded-lg !transition-colors",
          cancelButton: "!bg-white/80 !text-gray-700 hover:!bg-white !border !border-blue-200/40 !rounded-lg !backdrop-blur-sm !transition-colors",
          success: "!bg-gradient-to-r !from-blue-50/98 !via-sky-50/95 !to-blue-50/98 !backdrop-blur-lg !border-blue-300/50 !text-blue-800 !shadow-xl !shadow-blue-100/50",
          error: "!bg-gradient-to-r !from-red-50/98 !via-rose-50/95 !to-red-50/98 !backdrop-blur-lg !border-red-300/50 !text-red-800 !shadow-red-200/30",
          warning: "!bg-gradient-to-r !from-amber-50/98 !via-yellow-50/95 !to-amber-50/98 !backdrop-blur-lg !border-amber-300/50 !text-amber-800 !shadow-amber-200/30",
          info: "!bg-gradient-to-r !from-blue-50/98 !via-sky-50/95 !to-blue-50/98 !backdrop-blur-lg !border-blue-300/50 !text-blue-800 !shadow-blue-200/30",
        },
      }}
      richColors
      expand={false}
      duration={4000}
      {...props}
    />
  );
};

export { Toaster };
