import { createContext, useContext, HTMLAttributes } from "react";
import { clsx } from "clsx";
import { Button } from "./button";

const AlertDialogContext = createContext<{ onOpenChange: (open: boolean) => void }>({
  onOpenChange: () => {},
});

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  if (!open) return null;
  return (
    <AlertDialogContext.Provider value={{ onOpenChange }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
        {children}
      </div>
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "relative z-50 w-full max-w-md rounded-xl bg-white shadow-2xl p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("mb-4", className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={clsx("text-lg font-semibold text-slate-900", className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={clsx("text-sm text-slate-500 mt-1", className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("flex justify-end gap-3 mt-6", className)} {...props} />;
}

interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export function AlertDialogAction({ className, children, ...props }: AlertDialogActionProps) {
  return (
    <Button className={className} {...props}>
      {children}
    </Button>
  );
}

export function AlertDialogCancel({ className, children, onClick, ...props }: AlertDialogActionProps) {
  const { onOpenChange } = useContext(AlertDialogContext);
  return (
    <Button
      variant="outline"
      className={className}
      onClick={(e) => {
        onOpenChange(false);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
