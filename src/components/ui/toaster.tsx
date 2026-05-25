import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={2000}>
      {toasts.map(function ({ id, title, description, action, showCloseButton, ...props }) {
        const message = title ?? description;
        if (!message) return null;

        return (
          <Toast key={id} className={showCloseButton ? "pr-8" : undefined} {...props}>
            <ToastTitle
              className={
                action
                  ? "pr-2 text-[13px] font-medium leading-tight whitespace-normal break-words"
                  : "w-full text-center text-[13px] font-medium leading-tight whitespace-normal break-words"
              }
            >
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
