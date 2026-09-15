import type { Metadata } from "next";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Venv — Virtual Work Environment",
  description:
    "A simulated workplace for recent graduates: a Manager assigns tasks, a Mentor reviews the work, HR tracks growth.",
};

// Applies the graduate's theme to <html data-theme> before the first
// paint — has to be a plain blocking <script>, not next/script, since
// the whole point is running before React (and Tailwind's CSS
// variables under [data-theme="light"] in globals.css) ever draw a
// frame. lib/theme.tsx's ThemeProvider picks up whatever this already
// set on mount, so there's exactly one source of truth, never two
// competing writes. Falls back to the OS preference on a first visit,
// dark otherwise — same default the app always had.
const NO_FLASH_THEME_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem("venv-theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg-base text-text-primary">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
