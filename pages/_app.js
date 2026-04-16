import { AuthProvider } from '../lib/auth-context';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
