import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  message: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { message: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message || 'The inspector hit a rendering error.' };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('JSON-LD inspector render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.message) {
      return (
        <div className="state-card" role="alert">
          <h2>Something went wrong in the inspector</h2>
          <p>{this.state.message}</p>
          <p>Refresh the inspector. Page data stays on this device.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
