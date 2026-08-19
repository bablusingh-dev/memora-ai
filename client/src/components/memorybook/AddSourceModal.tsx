'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMemorybookStore } from '@/store/useMemorybookStore';
import { FileUp, Globe, Youtube, FileText, Loader2, Sparkles, UploadCloud } from 'lucide-react';

export function AddSourceModal() {
  const {
    isAddSourceModalOpen,
    setAddSourceModalOpen,
    uploadFileSource,
    ingestWebsiteSource,
    ingestYoutubeSource,
    createTextSource,
    isLoading,
  } = useMemorybookStore();

  const [activeTab, setActiveTab] = useState('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [webUrl, setWebUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select a PDF or document file');
      return;
    }
    setErrorMsg('');
    try {
      await uploadFileSource(selectedFile);
      setSelectedFile(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload file');
    }
  };

  const handleWebIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webUrl.trim()) {
      setErrorMsg('Please enter a valid website URL');
      return;
    }
    setErrorMsg('');
    try {
      await ingestWebsiteSource(webUrl.trim());
      setWebUrl('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to scrape website via Firecrawl');
    }
  };

  const handleYoutubeIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) {
      setErrorMsg('Please enter a valid YouTube video URL');
      return;
    }
    setErrorMsg('');
    try {
      await ingestYoutubeSource(youtubeUrl.trim());
      setYoutubeUrl('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch YouTube transcript');
    }
  };

  const handleTextIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textTitle.trim() || !textContent.trim()) {
      setErrorMsg('Title and text content are required');
      return;
    }
    setErrorMsg('');
    try {
      await createTextSource(textTitle.trim(), textContent.trim());
      setTextTitle('');
      setTextContent('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create text note');
    }
  };

  return (
    <Dialog open={isAddSourceModalOpen} onOpenChange={setAddSourceModalOpen}>
      <DialogContent className="sm:max-w-[540px] bg-slate-100 dark:bg-zinc-900 border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-2xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.95)] text-foreground rounded-3xl p-5 space-y-3">
        {/* Header Section Card */}
        <DialogHeader className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs space-y-1.5">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Sparkles className="w-5 h-5 text-primary shrink-0" />
            Add Source Document
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Ground your workspace in factual context. Added sources are stored on Cloudinary & indexed into ParadeDB for BM25 RAG.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-destructive/10 text-destructive text-xs font-medium border-0">
            {errorMsg}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full bg-slate-200/80 dark:bg-zinc-950 p-1.5 rounded-2xl border-0 shadow-2xs">
            <TabsTrigger
              value="file"
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-primary rounded-xl border-0 transition-colors duration-150 shadow-2xs"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>File</span>
            </TabsTrigger>
            <TabsTrigger
              value="web"
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-primary rounded-xl border-0 transition-colors duration-150 shadow-2xs"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Website</span>
            </TabsTrigger>
            <TabsTrigger
              value="youtube"
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-primary rounded-xl border-0 transition-colors duration-150 shadow-2xs"
            >
              <Youtube className="w-3.5 h-3.5 text-red-500" />
              <span>YouTube</span>
            </TabsTrigger>
            <TabsTrigger
              value="text"
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-primary rounded-xl border-0 transition-colors duration-150 shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Text Note</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: FILE UPLOAD */}
          <TabsContent value="file" className="pt-3">
            <form onSubmit={handleFileUpload} className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs space-y-4">
              <div className="rounded-2xl p-6 text-center cursor-pointer bg-slate-100 dark:bg-zinc-850 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors duration-150 relative border-0">
                <input
                  type="file"
                  accept=".pdf,.txt,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3.5 rounded-2xl bg-primary/10 text-primary">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {selectedFile ? selectedFile.name : 'Click to select or drag PDF/Docs here'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                      PDF, DOCX, TXT up to 25MB (Uploaded to Cloudinary CDN)
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={!selectedFile || isLoading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 rounded-2xl border-0 shadow-xs gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4" /> : null}
                <span>Upload to Cloudinary & Index</span>
              </Button>
            </form>
          </TabsContent>

          {/* TAB 2: WEBSITE URL (FIRECRAWL) */}
          <TabsContent value="web" className="pt-3">
            <form onSubmit={handleWebIngest} className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Website URL (Firecrawl Scraper)</label>
                <Input
                  placeholder="https://example.com/research-paper"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  disabled={isLoading}
                  className="bg-slate-100 dark:bg-zinc-800/90 border-0 text-foreground placeholder:text-muted-foreground text-xs h-10 rounded-2xl focus-visible:ring-1 focus-visible:ring-primary shadow-inner"
                />
                <p className="text-[11px] text-muted-foreground">
                  Firecrawl converts webpage HTML into clean Markdown for high-quality chunking.
                </p>
              </div>

              <Button
                type="submit"
                disabled={!webUrl.trim() || isLoading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 rounded-2xl border-0 shadow-xs gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4" /> : null}
                <span>Crawl Website & Index</span>
              </Button>
            </form>
          </TabsContent>

          {/* TAB 3: YOUTUBE VIDEO */}
          <TabsContent value="youtube" className="pt-3">
            <form onSubmit={handleYoutubeIngest} className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">YouTube Video Link</label>
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={isLoading}
                  className="bg-slate-100 dark:bg-zinc-800/90 border-0 text-foreground placeholder:text-muted-foreground text-xs h-10 rounded-2xl focus-visible:ring-1 focus-visible:ring-primary shadow-inner"
                />
                <p className="text-[11px] text-muted-foreground">
                  Extracts video transcript and metadata for ParadeDB RAG indexing.
                </p>
              </div>

              <Button
                type="submit"
                disabled={!youtubeUrl.trim() || isLoading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 rounded-2xl border-0 shadow-xs gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4" /> : null}
                <span>Fetch Transcript & Index</span>
              </Button>
            </form>
          </TabsContent>

          {/* TAB 4: TEXT NOTE */}
          <TabsContent value="text" className="pt-3">
            <form onSubmit={handleTextIngest} className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Note Title</label>
                <Input
                  placeholder="e.g. Key Takeaways from Lecture 3"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  disabled={isLoading}
                  className="bg-slate-100 dark:bg-zinc-800/90 border-0 text-foreground placeholder:text-muted-foreground text-xs h-10 rounded-2xl focus-visible:ring-1 focus-visible:ring-primary shadow-inner"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Copied Text Content</label>
                <textarea
                  rows={4}
                  placeholder="Paste research text notes here..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-2xl bg-slate-100 dark:bg-zinc-800/90 text-foreground placeholder:text-muted-foreground px-3.5 py-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary border-0 shadow-inner"
                />
              </div>

              <Button
                type="submit"
                disabled={!textTitle.trim() || !textContent.trim() || isLoading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 rounded-2xl border-0 shadow-xs gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4" /> : null}
                <span>Save Note & Index</span>
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
