import { AuthProvider } from "./AuthProvider";
import { Toaster } from "./ui/sonner";
import LoginPage from "./LoginPage";

export default function LoginWrapper() {
  return (
    <AuthProvider>
      <LoginPage />
      <Toaster position="bottom-right" />
    </AuthProvider>
  );
}
