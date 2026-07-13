import React from 'react';
import { Button } from "@/components/ui/button";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
      localStorage.clear();
      window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <h1 className="text-4xl font-bold text-destructive">Oops!</h1>
            <p className="text-xl font-semibold">Something went wrong.</p>
            <div className="bg-muted p-4 rounded-md text-left overflow-auto max-h-64 text-sm font-mono my-4">
              <p className="font-bold text-destructive mb-2">{this.state.error?.toString()}</p>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {this.state.errorInfo?.componentStack}
              </p>
            </div>
            <div className="flex gap-4 justify-center">
                <Button onClick={this.handleReload}>Reload Page</Button>
                <Button variant="outline" onClick={this.handleReset}>Clear Cache & Reload</Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
