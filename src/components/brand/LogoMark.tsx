import type { ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import notifymeIcon from "@/assets/notifyme-icon.png";

type LogoMarkProps = ImgHTMLAttributes<HTMLImageElement>;

export const LogoMark = ({ className, alt = "OpenAlert", ...props }: LogoMarkProps) => (
  <img
    src={notifymeIcon}
    alt={alt}
    className={cn("object-contain rounded-lg", className)}
    {...props}
  />
);
