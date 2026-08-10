'use client';

import React, { useState } from 'react';
import { Bot, Send, Sparkles, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  citations?: string[];
}

export function ChatStudioPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'assistant',
      text: 'Hello! I am your Memora AI assistant. Upload sources on the left panel, and I will synthesize summaries and answer your queries using ParadeDB BM25 vectorless search.',
      citations: ['Deep Learning Guide: p.4'],
    },
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), sender: 'user', text: input },
    ]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-background p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          <h2 className="font-semibold text-lg">Chat & Studio Workspace</h2>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1 text-xs">
          <Database className="w-3 h-3 text-primary" /> ParadeDB BM25 RAG
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.sender === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-none'
                  : 'bg-card border border-border/80 text-foreground rounded-bl-none shadow-sm'
              }`}
            >
              <p>{msg.text}</p>
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/40 flex flex-wrap gap-1">
                  {msg.citations.map((cite, i) => (
                    <span key={i} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      📌 {cite}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center space-x-2 bg-card border border-border p-2 rounded-xl">
        <Input
          placeholder="Ask a question about your sources..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="border-none focus-visible:ring-0 text-sm"
        />
        <Button size="icon" onClick={handleSend} className="bg-primary text-primary-foreground">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
