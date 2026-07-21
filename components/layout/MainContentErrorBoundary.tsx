"use client";

import { ErrorBoundary } from "@/components/features/ErrorBoundary";

type MainContentErrorBoundaryProps = Readonly<{
  children: React.ReactNode;
}>;

/**
 * Client wrapper so route layouts can use the class-based error boundary.
 */
export function MainContentErrorBoundary({
  children,
}: MainContentErrorBoundaryProps) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
