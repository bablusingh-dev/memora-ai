'use client';

import React from 'react';
import { FileText, Plus, Globe, Upload, Search, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function SourcesPanel() {
  const sources = [
    { id: '1', title: 'Deep Learning Architecture Guide.pdf', type: 'PDF', status: 'ready', chunks: 24 },
    { id: '2', title: 'ParadeDB Vectorless Search Spec.web', type: 'Web', status: 'ready', chunks: 12 },
  ];

  return (
    <div className="flex flex-col h-full bg-card/60 backdrop-blur border-r border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg tracking-tight">Sources</h2>
        </div>
        <Badge variant="outline" className="text-xs border-primary/40 text-primary">
          BM25 Indexed
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Add sources to ground your AI assistant in facts. Powered by ParadeDB Vectorless Search.
      </p>

      <Button className="w-full justify-start space-x-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30">
        <Plus className="w-4 h-4" />
        <span>Add Source Document</span>
      </Button>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {sources.map((source) => (
          <Card key={source.id} className="bg-secondary/40 border-border/60 hover:border-primary/50 transition-all cursor-pointer">
            <CardContent className="p-3 flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-background/80 text-primary">
                {source.type === 'PDF' ? <FileText className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{source.title}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {source.chunks} chunks
                  </Badge>
                  <span className="flex items-center text-[10px] text-emerald-400">
                    <CheckCircle2 className="w-3 h-3 mr-0.5" /> Ready
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
