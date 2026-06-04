"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
            <h2 className="font-serif text-2xl font-bold text-warm-charcoal">
              Something went wrong
            </h2>
            <p className="mt-2 text-warm-grey">
              Please refresh the page or try again later.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-6 rounded-full bg-caramel px-6 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
            >
              Try Again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
