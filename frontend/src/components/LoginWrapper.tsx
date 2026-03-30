import { AuthProvider } from "./AuthProvider";
import LoginPage from "./LoginPage";

export default function LoginWrapper() {
  return (
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  );
}
