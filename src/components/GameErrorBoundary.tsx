import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

interface GameErrorBoundaryProps {
  resetKey: string;
  canReturnToRoomMenu: boolean;
  onReturnToRoomMenu: () => void;
  title?: string;
  subtitle?: string;
  returnLabel?: string;
  children: ReactNode;
}

interface GameErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Isolates runtime errors inside Parcheesi so both players ALWAYS stay connected to
 * their Cloud Firestore room, voice call, and live chat, and can return safely to the Room Menu.
 */
export class GameErrorBoundary extends Component<GameErrorBoundaryProps, GameErrorBoundaryState> {
  public state: GameErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): GameErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Parcheesi GameErrorBoundary] Caught runtime error safely inside room:', error, info.componentStack);
  }

  public componentDidUpdate(prevProps: GameErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleReturn = (): void => {
    this.setState({ hasError: false, error: null });
    try {
      this.props.onReturnToRoomMenu();
    } catch (err) {
      console.error('[Parcheesi GameErrorBoundary] Return to Room Menu failed:', err);
    }
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const message = this.state.error?.message || 'Erreur inattendue dans Parcheesi.';

    return (
      <div
        data-testid="game-error-boundary"
        role="alert"
        className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6 bg-[#FAF7F2]"
      >
        <div className="w-full max-w-md rounded-3xl bg-white border border-[#EAE4DC] shadow-[0_8px_28px_rgba(31,36,45,0.08)] p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FFE8E2] border border-[#FFD1C7] flex items-center justify-center text-[#FF6B57]">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-[#1F242D]">
              {this.props.title ?? 'Oups, Parcheesi a rencontré une erreur'}
            </h2>
            <p className="text-xs sm:text-sm text-[#6B7280] leading-relaxed">
              {this.props.subtitle ?? 'Ton salon, ton micro et le chat restent 100 % connectés.'}
            </p>
          </div>

          <div className="rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] p-3 text-start">
            <p
              data-testid="game-error-message"
              className="font-mono text-xs text-[#B91C1C] break-words select-text"
            >
              {message}
            </p>
          </div>

          {this.props.canReturnToRoomMenu && (
            <button
              type="button"
              data-testid="game-error-return-menu"
              onClick={this.handleReturn}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-extrabold bg-[#FF6B57] hover:bg-[#F25743] text-white shadow-[0_6px_18px_-4px_rgba(255,107,87,0.45)] transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 shrink-0 rtl:rotate-180" />
              <span>{this.props.returnLabel ?? 'Menu du salon'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }
}
