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
import { useNotebookStore } from '@/store/useNotebookStore';
import { FileUp, Globe, Youtube, FileText, Loader2, Sparkles, UploadCloud } from 'lucide-react';

export function AddSourceModal() {
  const { isAddSourceModalOpen, setAddSourceModalOpen, uploadFileSource, ingestWebsiteSource, ingestYoutubeSource, createTextSource, isLoading } = useNotebookStore();

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
      <DialogContent className="sm:max-w-[540px] bg-white border border-slate-200 shadow-2xl text-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Sparkles className="w-5 h-5 text-primary" />
            Add Source Document
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Ground your notebook in factual context. Added sources are stored on Cloudinary & indexed into ParadeDB for BM25 RAG.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium">
            {errorMsg}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
          <TabsList className="grid grid-cols-4 w-full bg-slate-100 border border-slate-200 p-1">
            <TabsTrigger value="file" className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <FileUp className="w-3.5 h-3.5" /> File
            </TabsTrigger>
            <TabsTrigger value="web" className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Globe className="w-3.5 h-3.5" /> Website
            </TabsTrigger>
            <TabsTrigger value="youtube" className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Youtube className="w-3.5 h-3.5 text-red-500" /> YouTube
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <FileText className="w-3.5 h-3.5" /> Text Note
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: FILE UPLOAD */}
          <TabsContent value="file" className="pt-3">
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-primary rounded-2xl p-6 text-center cursor-pointer bg-slate-50/50 transition-all relative">
                <input
                  type="file"
                  accept=".pdf,.txt,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedFile ? selectedFile.name : 'Click to select or drag PDF/Docs here'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      PDF, DOCX, TXT up to 25MB (Uploaded to Cloudinary CDN)
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={!selectedFile || isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 shadow-sm">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Upload to Cloudinary & Index
              </Button>
            </form>
          </TabsContent>

          {/* TAB 2: WEBSITE URL (FIRECRAWL) */}
          <TabsContent value="web" className="pt-3">
            <form onSubmit={handleWebIngest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">Website URL (Firecrawl Scraper)</label>
                <Input
                  placeholder="https://example.com/research-paper"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  disabled={isLoading}
                  className="bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 font-medium text-xs h-10"
                />
                <p className="text-[11px] text-slate-500">
                  Firecrawl converts webpage HTML into clean Markdown for high-quality chunking.
                </p>
              </div>

              <Button type="submit" disabled={!webUrl.trim() || isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 shadow-sm">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Crawl Website & Index
              </Button>
            </form>
          </TabsContent>

          {/* TAB 3: YOUTUBE VIDEO */}
          <TabsContent value="youtube" className="pt-3">
            <form onSubmit={handleYoutubeIngest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">YouTube Video Link</label>
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={isLoading}
                  className="bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 font-medium text-xs h-10"
                />
                <p className="text-[11px] text-slate-500">
                  Extracts video transcript and metadata for ParadeDB RAG indexing.
                </p>
              </div>

              <Button type="submit" disabled={!youtubeUrl.trim() || isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 shadow-sm">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Fetch Transcript & Index
              </Button>
            </form>
          </TabsContent>

          {/* TAB 4: TEXT NOTE */}
          <TabsContent value="text" className="pt-3">
            <form onSubmit={handleTextIngest} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Note Title</label>
                <Input
                  placeholder="e.g. Key Takeaways from Lecture 3"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  disabled={isLoading}
                  className="bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 font-medium text-xs h-10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Copied Text Content</label>
                <textarea
                  rows={4}
                  placeholder="Paste research text notes here..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-md border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <Button type="submit" disabled={!textTitle.trim() || !textContent.trim() || isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 shadow-sm">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Note & Index
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
