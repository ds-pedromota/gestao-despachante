import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { toast } from "@/components/ui/use-toast";
import { pagesConfig } from './pages.config';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Loader2 } from "lucide-react";
import PageNotFound from './lib/PageNotFound';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './lib/AuthContext';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// Configuração do QueryClient com tratamento global de erros
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro na requisição",
        description: error.message || "Ocorreu um erro ao carregar os dados.",
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro na operação",
        description: error.message || "Falha ao salvar os dados.",
      });
    },
  }),
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  const handleLogin = () => {
    localStorage.setItem("isAuthenticated", "true");
    window.location.reload(); // Recarrega para que o AuthContext pegue o novo estado
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
        <Routes>
          <Route path="/" element={
            <LayoutWrapper currentPageName={mainPageKey}>
              <MainPage />
            </LayoutWrapper>
          } />
          {Object.entries(Pages).map(([path, Page]) => (
            <Route
              key={path}
              path={`/${path}`}
              element={
                <LayoutWrapper currentPageName={path}>
                  <Page />
                </LayoutWrapper>
              }
            />
          ))}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
        <Toaster />
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </QueryClientProvider>
  );
}