'use client';

import React from 'react';
import { Headphones, Play, Sparkles, BookOpen, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function AudioOverviewPanel() {
  return (
    <div className="flex flex-col h-full bg-card/60 backdrop-blur border-l border-border p-4 space-y-4">
      <div className="flex items-center space-x-2">
        <Headphones className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-lg tracking-tight">Audio Overview & Studio</h2>
      </div>

      {/* Audio Overview Card */}
      <Card className="bg-gradient-to-br from-primary/15 via-secondary/40 to-background border-primary/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="border-primary/50 text-primary text-[10px]">
              AI Podcast
            </Badge>
            <span className="text-xs text-muted-foreground">12:45 min</span>
          </div>

          <h3 className="font-medium text-sm">Deep Learning Architecture Overview</h3>
          <p className="text-xs text-muted-foreground">
            A conversational deep dive generated from your uploaded sources.
          </p>

          <Button className="w-full justify-center space-x-2 bg-primary text-primary-foreground shadow-md hover:bg-primary/90">
            <Play className="w-4 h-4 fill-current" />
            <span>Generate Audio Overview</span>
          </Button>
        </CardContent>
      </Card>

      {/* Quick Studio Guides */}
      <div className="space-y-2 flex-1">
        <div className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5" />
          <span>Studio Outputs</span>
        </div>

        <Card className="bg-secondary/30 border-border/60 hover:bg-secondary/50 transition-all cursor-pointer">
          <CardContent className="p-3 flex items-center space-x-3">
            <BookOpen className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs font-medium">Study Guide</p>
              <p className="text-[10px] text-muted-foreground">Key takeaways & flashcards</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-secondary/30 border-border/60 hover:bg-secondary/50 transition-all cursor-pointer">
          <CardContent className="p-3 flex items-center space-x-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs font-medium">Executive Briefing</p>
              <p className="text-[10px] text-muted-foreground">High-level bullet summary</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
