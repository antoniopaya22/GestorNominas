import { AuthProvider } from "./AuthProvider";
import { ToastProvider } from "./Toast";
import LoginPage from "./LoginPage";

export default function LoginWrapper() {
  return (
    <AuthProvider>
      <ToastProvider>
        <LoginPage />
      </ToastProvider>
    </AuthProvider>
  );
}
