import { MainContentErrorBoundary } from "@/components/layout/MainContentErrorBoundary";

type RoutesLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

/**
 * Shared layout for main app pages — centered content container.
 */
export default function RoutesLayout({ children }: RoutesLayoutProps) {
  return (
    <MainContentErrorBoundary>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </div>
    </MainContentErrorBoundary>
  );
}
