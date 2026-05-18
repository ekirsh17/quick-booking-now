import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, showCloseButton, ...props }) {
        const message = title ?? description;
        if (!message) return null;

        return (
          <Toast key={id} className={showCloseButton ? "pr-8" : undefined} {...props}>
            <ToastTitle className={action ? "truncate pr-2 text-[13px] font-medium" : "w-full truncate text-center text-[13px] font-medium"}>
              {message}
            </ToastTitle>
            {action}
            {showCloseButton ? <ToastClose /> : null}
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
