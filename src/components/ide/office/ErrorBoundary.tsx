import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  name: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class OfficeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`OfficeEditor(${this.props.name}) crashed:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <p className="text-lg font-semibold">Editor crashed</p>
          <p className="text-sm text-center max-w-md">
            The {this.props.name} editor encountered an error.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              this.setState({ hasError: false, error: null });
            }}
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
