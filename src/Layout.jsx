import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, FileText, Settings, Menu, X, LogOut 
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import logo from "@/pages/logo.png";

const navigation = [
  { name: "Dashboard", page: "Home", icon: LayoutDashboard },
  { name: "Serviços", page: "Servicos", icon: FileText },
  { name: "Configurações", page: "Configuracoes", icon: Settings },
];

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("authToken");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={createPageUrl("Home")} className="flex items-center gap-3">
              <div className="w-10 h-10 from-slate-800 to-slate-600 rounded-xl flex items-center justify-center shadow-lg">
                <img src={logo} alt="" className="w-full h-full object-contain" />
              </div>
              <span className="text-xl font-bold text-slate-800 tracking-tight">
              Despachante
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link key={item.page} to={createPageUrl(item.page)}>
                    <Button 
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "gap-2",
                        isActive && "bg-slate-100"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.name}
                    </Button>
                  </Link>
                );
              })}
              <Button 
                variant="ghost" 
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </nav>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <nav className="px-4 py-3 space-y-1">
              {navigation.map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link 
                    key={item.page} 
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Button 
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-2",
                        isActive && "bg-slate-100"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.name}
                    </Button>
                  </Link>
                );
              })}
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500 text-center sm:text-left">
              © 2026 Sistema de Gerenciamento de Despachante
            </p>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span>Versão 1.0.1</span>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-2">
                <span className="text-xs">Desenvolvido por</span>
                <a href="https://dspedroportfolio.vercel.app/" target="_blank" rel="noopener noreferrer" title="Desenvolvido por JPedro Mota" className="font-semibold hover:text-slate-700 transition-colors">
                  JPedro Mota
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}