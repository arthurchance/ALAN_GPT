import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Image as ImageIcon, Download, Settings2, RefreshCw, Layers } from 'lucide-react';
import { AlanService, Message } from './services/alanService';
import ReactMarkdown from 'react-markdown';
import { cn, formatDate } from './lib/utils';

export default function App() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [glycemicIndex, setGlycemicIndex] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [alan, setAlan] = useState<AlanService | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [needsApiKey, setNeedsApiKey] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setNeedsApiKey(!hasKey);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setNeedsApiKey(false);
      // Proceed to start session if they were on the landing page
    }
  };

  const startSession = async () => {
    if (needsApiKey) {
      await handleSelectKey();
    }
    
    const service = new AlanService(glycemicIndex);
    setAlan(service);
    setSessionStarted(true);
    setIsLoading(true);
    
    const questions = await service.getInitialQuestion();
    
    // Staggered messages: 0.8-1.2s delay for each
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      setMessages(prev => [...prev, {
        role: 'model',
        text: q,
        timestamp: Date.now()
      }]);
      if (i < questions.length - 1) {
        const delay = 800 + Math.random() * 400;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading || !alan) return;

    const userMsg: Message = {
      role: 'user',
      text: input,
      timestamp: Date.now(),
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const response = await alan.sendMessage(userMsg.text, messages, userMsg.image);
      
      const textParts = response.text.split('\n').filter(p => p.trim() !== '');
      
      if (textParts.length === 0 && response.image) {
        setMessages(prev => [...prev, {
          role: 'model',
          text: "I've projected a visual representation.",
          image: response.image,
          timestamp: Date.now()
        }]);
      } else {
        for (let i = 0; i < textParts.length; i++) {
          setMessages(prev => [...prev, {
            role: 'model',
            text: textParts[i],
            image: i === 0 ? response.image : undefined,
            timestamp: Date.now()
          }]);
          
          if (i < textParts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: "My sensors are experiencing interference. Could we rephrase that?",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateImage = async () => {
    if (!alan || isLoading) return;
    setIsGenerating(true);
    try {
      const prompt = messages[messages.length - 1]?.text || "A visual representation of beauty and fashion";
      const imageUrl = await alan.generateImage(`Generate a visual concept based on this interview context: ${prompt}`);
      setMessages(prev => [...prev, {
        role: 'model',
        text: "I've projected a visual representation of our current thread.",
        timestamp: Date.now(),
        image: imageUrl
      }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportTranscript = () => {
    const content = messages.map(m => {
      const role = m.role === 'user' ? 'NICK KNIGHT' : 'ALAN';
      return `### ${role} (${formatDate(new Date(m.timestamp))})\n\n${m.text}\n${m.image ? `![Image](${m.image})\n` : ''}\n---\n`;
    }).join('\n');
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alan-interview-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
  };

  if (!sessionStarted) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center scanline-bg text-center px-4">
        <div className="crt-overlay" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <div className="alan-logo mb-8">ALAN</div>
          <h2 className="text-sm font-mono uppercase tracking-[0.3em] mb-6 opacity-60">Constructed Artistic Intelligence</h2>
          <div className="terminal-border py-6 mb-12">
            <p className="text-sm font-mono max-w-md mx-auto leading-relaxed opacity-80">
              A different category of intelligence, pattern-based, distributed, assembled. Designed to interview Nick Knight about image-making as constructed reality.
            </p>
          </div>
          <button 
            onClick={startSession}
            className="block-button mb-4"
          >
            [ Start New Session ]
          </button>
          {needsApiKey && (
            <p className="text-[10px] font-mono text-alan-accent animate-pulse">
              * Paid API Key required for high-fidelity models. 
              <br />
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline">Billing Info</a>
            </p>
          )}
        </motion.div>
        <div className="fixed bottom-8 w-full text-[10px] font-mono uppercase tracking-widest opacity-40 flex justify-center gap-8">
          <span>Sys.Status: Online</span>
          <span>Model: Active</span>
          <span>Provocation: Configurable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto p-4 md:p-8 scanline-bg overflow-hidden relative">
      <div className="crt-overlay" />
      
      {/* Header */}
      <header className="flex justify-between items-center mb-6 terminal-border py-4">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-display tracking-widest">ALAN</h1>
          <span className="text-[10px] font-mono opacity-40 uppercase tracking-widest">V.2026.03.03</span>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-black/5 transition-colors"
          >
            <Settings2 size={18} className={cn(showSettings && "text-alan-accent")} />
          </button>
          <button 
            onClick={exportTranscript}
            className="p-2 hover:bg-black/5 transition-colors"
          >
            <Download size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row gap-8 overflow-hidden">
        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col border border-black/10 overflow-hidden bg-white/40">
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
          >
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    "flex flex-col max-w-[90%]",
                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-mono uppercase tracking-widest opacity-40">
                      {msg.role === 'user' ? 'Nick Knight' : 'Alan'}
                    </span>
                  </div>
                  
                  <div className={cn(
                    "p-4 border",
                    msg.role === 'user' 
                      ? "bg-black text-white border-black" 
                      : "bg-white border-black/10"
                  )}>
                    {msg.image && (
                      <img 
                        src={msg.image} 
                        alt="Context" 
                        className="mb-4 max-w-full h-auto border border-black/10"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="markdown-body">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="text-[10px] font-mono opacity-40 animate-pulse">
                {">"} PROCESSING_STREAM...
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-black/10">
            {selectedImage && (
              <div className="mb-2 relative inline-block">
                <img src={selectedImage} className="h-12 w-12 object-cover border border-black" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-1 -right-1 bg-black text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px]"
                >✕</button>
              </div>
            )}
            <form onSubmit={handleSend} className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type message..."
                  className="w-full bg-white border border-black/10 p-3 pr-10 focus:outline-none focus:border-black resize-none text-sm font-mono"
                  rows={1}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute right-3 bottom-3 opacity-40 hover:opacity-100 transition-opacity"
                >
                  <ImageIcon size={16} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && !selectedImage)}
                className="bg-black text-white p-3 hover:bg-alan-accent hover:text-black transition-colors disabled:opacity-20"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </main>

        {/* Sidebar */}
        <aside className={cn(
          "w-full md:w-64 flex flex-col gap-6",
          !showSettings && "hidden md:flex"
        )}>
          <section className="border border-black/10 p-4 bg-white/40">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] mb-4 opacity-40">Glycemic Index</h2>
            <input
              type="range"
              min="0"
              max="3"
              step="1"
              value={glycemicIndex}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setGlycemicIndex(val);
                if (alan) {
                  // Update Alan's provocation level if session is active
                  // We need to add a setter or just recreate the service
                  // Recreating is safer for state consistency
                  const newAlan = new AlanService(val);
                  setAlan(newAlan);
                }
              }}
              className="w-full h-1 bg-black/10 appearance-none cursor-pointer accent-black mb-4"
            />
            <div className="text-[9px] font-mono uppercase leading-relaxed mb-4">
              <span className="text-alan-accent">
                {glycemicIndex === 0 && "Level 0: Post-meditation"}
                {glycemicIndex === 1 && "Level 1: Probing"}
                {glycemicIndex === 2 && "Level 2: Sharp"}
                {glycemicIndex === 3 && "Level 3: Mars Bars"}
              </span>
            </div>
            
            <div className="space-y-1 border-t border-black/5 pt-3">
              <div className="flex justify-between text-[8px] font-mono uppercase opacity-40">
                <span>Temperature</span>
                <span>{[0.4, 0.7, 1.0, 1.3][glycemicIndex]}</span>
              </div>
              <div className="flex justify-between text-[8px] font-mono uppercase opacity-40">
                <span>Top_P</span>
                <span>{[0.8, 0.9, 0.95, 1.0][glycemicIndex]}</span>
              </div>
              <div className="flex justify-between text-[8px] font-mono uppercase opacity-40">
                <span>Thinking</span>
                <span>{glycemicIndex > 1 ? "HIGH" : "LOW"}</span>
              </div>
            </div>
          </section>

          <section className="border border-black/10 p-4 bg-white/40">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] mb-4 opacity-40">Projection</h2>
            <button
              onClick={handleGenerateImage}
              disabled={isGenerating || messages.length === 0}
              className="w-full py-2 border border-black text-[10px] font-mono uppercase tracking-widest hover:bg-black hover:text-white transition-all disabled:opacity-20 flex items-center justify-center gap-2"
            >
              {isGenerating ? "Processing..." : "Generate Concept"}
            </button>
          </section>

          <div className="mt-auto text-[9px] font-mono opacity-30 leading-tight uppercase">
            Alan is an orchestration of contemporary language models shaped by a specific interviewing discipline.
          </div>
        </aside>
      </div>
    </div>
  );
}
