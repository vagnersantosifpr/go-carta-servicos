import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Gmail Readonly scope
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.setCustomParameters({
  prompt: 'select_account consent',
  access_type: 'offline',
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory.
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const handleRedirectAuth = async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken ?? null;
        if (token) {
          cachedAccessToken = token;
          if (onAuthSuccess) onAuthSuccess(result.user, token);
          return;
        }
      }
    } catch (error) {
      console.error('Redirect sign-in error:', error);
    }

    if (onAuthFailure) onAuthFailure();
  };

  void handleRedirectAuth();

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const getAuthErrorMessage = (error: any): string => {
  const code = error?.code;

  switch (code) {
    case 'auth/popup-blocked':
      return 'O popup de login foi bloqueado. Permita popups para este site e tente novamente.';
    case 'auth/popup-closed-by-user':
      return 'O processo de login foi cancelado. Tente novamente.';
    case 'auth/operation-not-allowed':
      return 'O login com Google não está habilitado no projeto do Firebase. Ative o provedor Google em Autenticação > Métodos de login.';
    case 'auth/unauthorized-domain':
      return 'Este domínio não está autorizado. Adicione localhost e o domínio atual em Autenticação > Configurações > Domínios autorizados.';
    case 'auth/network-request-failed':
      return 'Falha de rede ao conectar com o Google. Verifique sua conexão e tente novamente.';
    case 'auth/configuration-not-found':
      return 'Configuração do Firebase não encontrada. Verifique se a chave de API está correta e se o domínio (localhost) está autorizado nas restrições da chave no Google Cloud Console.';
    default:
      const defaultMessage = 'Falha ao autenticar com o Google. Certifique-se de permitir as permissões de leitura do Gmail e de que o login com Google esteja habilitado no Firebase.';
      const errorMessage = error?.message ? ` (Detalhe: ${error.message})` : '';
      return `${defaultMessage}${errorMessage}`;
  }
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth, provider);
      return null;
    }

    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
