import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./tooltips.css";
import "./backend.css";
import TooltipHints from "./tooltip-hints";

export const metadata: Metadata = {
  title: "CareCircle — Family care, together",
  description: "A calmer way for families to coordinate care, share updates, and support one another.",
  applicationName: "CareCircle",
};

export const viewport: Viewport = {
  themeColor: "#f6f7f3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><TooltipHints />{children}</body></html>;
}
