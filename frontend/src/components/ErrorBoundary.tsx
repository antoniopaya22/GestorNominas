import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-20 animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-danger-50 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-10 h-10 text-danger-400" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900 mb-1.5">Algo salió mal</h3>
          <p className="text-surface-500 text-sm max-w-sm mx-auto mb-6">
            Ha ocurrido un error inesperado. Intenta recargar la página.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="btn-primary"
          >
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
