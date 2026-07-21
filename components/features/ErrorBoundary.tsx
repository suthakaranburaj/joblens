"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logError } from "@/lib/utils/logger";

export type ErrorBoundaryProps = {
  children: ReactNode;
  /** Optional custom fallback; defaults to built-in recovery UI. */
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

/**
 * Catches runtime errors in client components and shows a recovery UI.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "An unexpected error occurred.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logError("React error boundary caught an error", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({ hasError: false, message: "" });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex w-full flex-1 items-center justify-center py-8">
          <Card className="w-full max-w-lg border-border shadow-sm">
            <CardHeader className="items-center text-center sm:items-start sm:text-left">
              <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="size-6" aria-hidden />
              </div>
              <CardTitle className="text-lg">Something went wrong</CardTitle>
              <CardDescription className="text-sm">
                {this.state.message}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You can try again or reload the page. If the problem persists,
                check the browser console for details.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={this.handleReset}>
                Try Again
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
