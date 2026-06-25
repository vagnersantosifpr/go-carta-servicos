import { useState, useEffect, useRef } from "react";
import { 
  initAuth, 
  googleSignIn, 
  logout,
  getAuthErrorMessage
} from "./firebase-auth";
import { User } from "firebase/auth";
import { 
  Mail, 
  LogOut, 
  Sparkles, 
  FileText, 
  Printer, 
  Copy, 
  Check, 
  ArrowRight, 
  Shield, 
  ListChecks, 
  Search, 
  Loader2, 
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Service {
  name: string;
  description: string;
  audience: string;
  requirements: string;
  howToRequest: string;
  deadline: string;
}

interface AnalysisResult {
  success: boolean;
  sectorName: string;
  identifiedServices: Service[];
  cartaDeServicosHtml: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<"services" | "document">("services");
  const [copied, setCopied] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  // Steps shown during AI mapping
  const loadingSteps = [
    "Conectando de forma segura à API do Gmail...",
    "Buscando as últimas mensagens da sua caixa institucional...",
    "Processando remetentes, assuntos e conteúdos...",
    "Analisando padrões com a inteligência artificial Gemini 3.5...",
    "Estruturando os serviços mapeados e gerando a Carta Oficial..."
  ];

  useEffect(() => {
    // Listen to Firebase Auth changes
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Simulated stepper for loading
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev: number) => {
          if (prev < loadingSteps.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(getAuthErrorMessage(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      setResult(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const runAnalysis = async () => {
    if (!accessToken) {
      setError("Token de acesso não encontrado. Faça login novamente.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro desconhecido ao analisar e-mails");
      }

      setResult(data);
      setActiveTab("services");
    } catch (err: any) {
      console.error("Analysis failed:", err);
      setError(err?.message || "Erro de rede ou falha na análise. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const cleanText = result.cartaDeServicosHtml
      .replace(/<[^>]*>/g, " ") // Strip HTML tags
      .replace(/\s+/g, " ")     // Collapse whitespace
      .trim();
    
    navigator.clipboard.writeText(cleanText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-[#1A1A1A] font-sans selection:bg-[#1A1A1A]/10 selection:text-[#1A1A1A] print:bg-white print:text-black">
      {/* Injecting Print Styles natively to hide interface elements when printing */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-content {
            display: block !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Institutional Header (Hidden on Print) */}
      <header className="no-print bg-[#FBFBF9] border-b border-[#1A1A1A]/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-none bg-[#1A1A1A] flex items-center justify-center text-white font-serif italic text-lg shadow-sm">
              S
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#1A1A1A]/50 block">
                Portal de Governança
              </span>
              <h1 className="text-xl font-serif italic font-medium text-[#1A1A1A] leading-none mt-1">
                Análise de Inbox e Carta de Serviços
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {user && (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className="text-[9px] uppercase tracking-widest text-[#1A1A1A]/40 font-bold">Setor Vinculado</div>
                  <div className="text-xs font-semibold max-w-[180px] truncate">{result?.sectorName || "Identificando..."}</div>
                </div>
                
                <div className="flex items-center gap-3 bg-white p-1.5 pr-3.5 border border-[#1A1A1A]/10 shadow-sm rounded-none">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || "Usuário"} 
                      className="w-7 h-7 rounded-none object-cover border border-[#1A1A1A]/15"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-none bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-serif italic">
                      {user.displayName?.charAt(0) || "U"}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-[#1A1A1A]/90 max-w-[130px] truncate font-mono">
                    {user.email?.split("@")[0]}
                  </span>
                  <button
                    onClick={handleLogout}
                    title="Desconectar"
                    className="p-1 hover:text-red-600 text-[#1A1A1A]/50 hover:bg-[#1A1A1A]/5 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-10">
        
        {/* Error Notification (Hidden on Print) */}
        {error && (
          <div className="no-print mb-8 p-5 bg-red-50/80 border border-red-200 text-red-900 rounded-none flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-700" />
            <div>
              <h4 className="font-serif italic font-bold text-lg text-red-950">Inconsistência identificada</h4>
              <p className="text-xs mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* 1. Landing / Auth State */}
        {needsAuth && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="no-print max-w-2xl mx-auto text-center py-12 md:py-20"
          >
            <span className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#1A1A1A]/40 mb-3 block">
              Ferramenta Institucional de Transparência
            </span>
            
            <h2 className="text-4xl font-serif font-medium leading-tight text-[#1A1A1A] mb-4 sm:text-5xl">
              Mapeie os serviços do seu setor de forma estruturada
            </h2>
            
            <p className="text-[#1A1A1A]/70 font-serif text-lg leading-relaxed mb-10 max-w-xl mx-auto italic">
              Conecte sua conta de e-mail institucional para que nosso modelo identifique as demandas recorrentes e elabore uma Carta de Serviços oficial em segundos.
            </p>

            {/* Authenticate Card with Editorial aesthetic */}
            <div className="bg-white p-8 sm:p-10 border border-[#1A1A1A]/10 shadow-sm text-left mb-8 rounded-none">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A] mb-6 flex items-center gap-2.5 pb-3 border-b border-[#1A1A1A]/10">
                <Shield className="w-4.5 h-4.5 text-[#1A1A1A]/60" />
                Segurança, Governança & Privacidade
              </h3>
              
              <div className="space-y-4 text-sm text-[#1A1A1A]/75 mb-8 font-serif leading-relaxed">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-[#1A1A1A]/40 mt-1">[01]</span>
                  <p><strong>Apenas leitura:</strong> O sistema solicita permissão exclusiva para leitura de correspondências (<code>gmail.readonly</code>), impedindo alterações ou envios em seu nome.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-[#1A1A1A]/40 mt-1">[02]</span>
                  <p><strong>Privacidade Garantida:</strong> Os dados processados pelo Gemini são voláteis: permanecem em memória de execução apenas durante a geração da Carta e nunca são persistidos em banco de dados.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-[#1A1A1A]/40 mt-1">[03]</span>
                  <p><strong>Padrão de Qualidade:</strong> O catálogo gerado atende estritamente às regulamentações e estruturas públicas de governança.</p>
                </div>
              </div>

              {/* Editorial Material Button */}
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full py-4 px-6 bg-[#1A1A1A] hover:bg-[#333333] text-white rounded-none text-xs uppercase tracking-widest font-bold shadow transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
              >
                {isLoggingIn ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                )}
                <span>Acessar Inbox Institucional</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* 2. Logged In Action View */}
        {user && !result && !isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="no-print max-w-xl mx-auto py-12"
          >
            <div className="bg-white rounded-none border border-[#1A1A1A]/10 p-8 sm:p-10 shadow-sm text-center">
              <div className="w-12 h-12 rounded-none bg-[#1A1A1A]/5 text-[#1A1A1A] flex items-center justify-center mx-auto mb-6">
                <Search className="w-5 h-5" />
              </div>

              <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#1A1A1A]/50 block mb-1">
                Conexão Autorizada
              </span>
              <h2 className="text-2xl font-serif italic text-[#1A1A1A] mb-1">
                Análise Pronta para Início
              </h2>
              <p className="text-xs text-[#1A1A1A]/50 font-mono mb-8">
                {user.email}
              </p>

              <div className="p-5 bg-[#FBFBF9] border border-[#1A1A1A]/5 text-left mb-8">
                <p className="text-xs uppercase tracking-wider font-bold text-[#1A1A1A] mb-3 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Fluxo de Processamento
                </p>
                <ul className="space-y-2.5 text-xs text-[#1A1A1A]/70 font-serif leading-relaxed">
                  <li className="flex gap-2">
                    <span className="font-mono text-[10px] text-[#1A1A1A]/40 mt-0.5">[1]</span>
                    <span>Requisição segura das últimas correspondências para fins estatísticos e descritivos.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-[10px] text-[#1A1A1A]/40 mt-0.5">[2]</span>
                    <span>Identificação automatizada de fluxos, prazos e tipos de público por similaridade linguística.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono text-[10px] text-[#1A1A1A]/40 mt-0.5">[3]</span>
                    <span>Consolidação e formatação de minuta conforme o padrão oficial de administração.</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={runAnalysis}
                className="w-full bg-[#1A1A1A] hover:bg-[#333333] text-white font-bold uppercase tracking-widest text-xs py-4 px-6 rounded-none shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Iniciar Mapeamento Cognitivo
              </button>
            </div>
          </motion.div>
        )}

        {/* 3. Loading State (Animated Steps) */}
        {isLoading && (
          <div className="no-print max-w-xl mx-auto py-16 text-center">
            <div className="inline-block relative mb-8">
              <div className="w-12 h-12 rounded-none border border-[#1A1A1A]/10 border-t-[#1A1A1A] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#1A1A1A] animate-pulse" />
              </div>
            </div>

            <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#1A1A1A]/40 block mb-1">
              Processamento em Lote
            </span>
            <h3 className="text-2xl font-serif italic text-[#1A1A1A] mb-4">
              Mapeando correspondências...
            </h3>
            
            <div className="min-h-[48px] px-4 max-w-md mx-auto">
              <AnimatePresence mode="wait">
                <motion.p 
                  key={loadingStep}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-xs text-[#1A1A1A]/70 italic font-serif leading-relaxed"
                >
                  {loadingSteps[loadingStep]}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Simulated progress indicator */}
            <div className="w-40 h-px bg-[#1A1A1A]/10 mx-auto mt-8 overflow-hidden">
              <motion.div 
                initial={{ width: "10%" }}
                animate={{ width: `${(loadingStep + 1) * 20}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-[#1A1A1A]"
              />
            </div>
          </div>
        )}

        {/* 4. Results View */}
        {result && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Header / Meta Card (Hidden on Print) */}
            <div className="no-print bg-white rounded-none border border-[#1A1A1A]/10 p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="inline-flex px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A] bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 mb-3">
                  DIAGNÓSTICO CONCLUÍDO
                </span>
                <h2 className="text-3xl font-serif text-[#1A1A1A] leading-tight">
                  Setor: <span className="italic">{result.sectorName}</span>
                </h2>
                <p className="text-xs text-[#1A1A1A]/50 mt-1.5 font-mono">
                  Identificados {result.identifiedServices.length} serviços estruturados com base em comunicações de e-mail institucional.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2.5 border border-[#1A1A1A]/20 hover:border-[#1A1A1A] bg-white text-[#1A1A1A] font-bold uppercase tracking-widest text-[10px] rounded-none transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir / PDF
                </button>
                
                <button
                  onClick={runAnalysis}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#333] text-white font-bold uppercase tracking-widest text-[10px] rounded-none transition-all shadow-sm cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  Reanalisar Caixa
                </button>
              </div>
            </div>

            {/* Navigation Tabs (Hidden on Print) */}
            <div className="no-print flex border-b border-[#1A1A1A]/10">
              <button
                onClick={() => setActiveTab("services")}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-xs uppercase tracking-widest transition-all ${
                  activeTab === "services"
                    ? "border-[#1A1A1A] text-[#1A1A1A]"
                    : "border-transparent text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                Catálogo de Serviços ({result.identifiedServices.length})
              </button>
              
              <button
                onClick={() => setActiveTab("document")}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-xs uppercase tracking-widest transition-all ${
                  activeTab === "document"
                    ? "border-[#1A1A1A] text-[#1A1A1A]"
                    : "border-transparent text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Minuta da Carta Oficial
              </button>
            </div>

            {/* Content Area */}
            <div>
              {/* TAB 1: Services Catalog */}
              {activeTab === "services" && (
                <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-6">
                  {result.identifiedServices.length === 0 ? (
                    <div className="col-span-2 text-center py-16 bg-white border border-[#1A1A1A]/10">
                      <AlertCircle className="w-10 h-10 text-[#1A1A1A]/30 mx-auto mb-4" />
                      <p className="font-serif italic text-slate-500">Nenhum serviço mapeado de forma conclusiva.</p>
                    </div>
                  ) : (
                    result.identifiedServices.map((service, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white border border-[#1A1A1A]/10 p-6 flex flex-col justify-between hover:border-[#1A1A1A] transition-all relative rounded-none"
                      >
                        <div>
                          {/* Elegant absolute layout indicator */}
                          <span className="absolute top-4 right-4 text-3xl font-serif italic text-[#1A1A1A]/10 font-bold select-none">
                            {String(idx + 1).padStart(2, "0")}
                          </span>

                          <div className="mb-4 pr-10">
                            <span className="inline-block px-2 py-0.5 bg-[#1A1A1A]/5 text-[#1A1A1A]/60 text-[9px] font-mono border border-[#1A1A1A]/5 uppercase tracking-wider mb-2">
                              Prazo: {service.deadline}
                            </span>
                            <h3 className="text-lg font-bold text-[#1A1A1A] uppercase tracking-wide leading-tight">
                              {service.name}
                            </h3>
                          </div>

                          <p className="text-[#1A1A1A]/70 text-sm mb-6 font-serif leading-relaxed">
                            {service.description}
                          </p>

                          <div className="space-y-3.5 border-t border-[#1A1A1A]/10 pt-4">
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 block font-mono">Público Beneficiário</span>
                              <p className="text-[#1A1A1A]/80 text-xs font-sans mt-0.5 font-medium">{service.audience}</p>
                            </div>
                            
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 block font-mono">Requisitos Oficiais</span>
                              <p className="text-[#1A1A1A]/80 text-xs font-sans mt-0.5 leading-relaxed">{service.requirements}</p>
                            </div>

                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 block font-mono">Meio de Solicitação</span>
                              <p className="text-[#1A1A1A] text-xs font-sans font-semibold mt-1 flex items-center gap-1.5">
                                <ArrowRight className="w-3 h-3 text-[#1A1A1A]/50" />
                                {service.howToRequest}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: Draft Document */}
              {activeTab === "document" && (
                <div className="no-print max-w-4xl mx-auto">
                  <div className="flex justify-end gap-3 mb-5">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-4 py-2 text-[#1A1A1A] hover:bg-[#1A1A1A]/5 border border-[#1A1A1A]/20 hover:border-[#1A1A1A] bg-white rounded-none text-xs uppercase tracking-widest font-bold transition-all cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar Texto
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-1.5 px-4 py-2 text-white bg-[#1A1A1A] hover:bg-[#333] rounded-none text-xs uppercase tracking-widest font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir Documento
                    </button>
                  </div>

                  {/* Document Container */}
                  <div className="bg-white border border-[#1A1A1A]/10 rounded-none p-10 sm:p-14 md:p-18 relative overflow-hidden font-serif prose prose-slate max-w-none shadow-sm">
                    {/* Official header layout simulation */}
                    <div className="border-b-2 border-[#1A1A1A] pb-8 mb-8 text-center">
                      <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#1A1A1A]/40 mb-3">
                        Proposta de Documento Administrativo
                      </div>
                      <h2 className="text-4xl font-serif leading-none text-[#1A1A1A] mt-1">
                        Carta de Serviços ao Cidadão
                      </h2>
                      <div className="w-16 h-px bg-[#1A1A1A] mx-auto mt-6"></div>
                      <p className="text-[10px] text-[#1A1A1A]/40 font-mono mt-3 uppercase tracking-wider">
                        Emitido por: {result.sectorName} • Data: {new Date().toLocaleDateString("pt-BR")}
                      </p>
                    </div>

                    <div 
                      className="text-[#1A1A1A]/90 leading-relaxed font-serif text-[15px] space-y-6 text-justify"
                      dangerouslySetInnerHTML={{ __html: result.cartaDeServicosHtml }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Printable View (Visible strictly when printing, hidden dynamically on browser) */}
            <div className="hidden print-content py-8 font-serif max-w-none text-slate-950">
              <div className="text-center border-b-4 border-slate-900 pb-6 mb-8">
                <h1 className="text-3xl font-black uppercase tracking-tight">CARTA DE SERVIÇOS</h1>
                <h2 className="text-xl font-bold mt-1 uppercase text-slate-700">SETOR: {result.sectorName}</h2>
                <p className="text-sm text-slate-500 font-mono mt-2">
                  Documento emitido em {new Date().toLocaleDateString("pt-BR")} - IFPR
                </p>
              </div>

              <div 
                className="prose max-w-none leading-relaxed space-y-4 text-justify"
                dangerouslySetInnerHTML={{ __html: result.cartaDeServicosHtml }}
              />
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer (Hidden on Print) */}
      <footer className="no-print bg-[#FBFBF9] border-t border-[#1A1A1A]/10 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 text-center text-[10px] uppercase tracking-widest text-[#1A1A1A]/40 font-mono font-bold">
          <p>© {new Date().getFullYear()} - Framework de Governança Institucional</p>
          <p className="mt-1.5">Mapeamento automatizado em conformidade com as boas práticas de integridade acadêmica e administrativa.</p>
        </div>
      </footer>
    </div>
  );
}
