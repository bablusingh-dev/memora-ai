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

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Web state
  const [webUrl, setWebUrl] = useState('');

  // YouTube state
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Text state
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
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Add Source Document
          </DialogTitle>
          <DialogDescription>
            Ground your notebook in factual context. Added sources are stored on Cloudinary & indexed into ParadeDB for BM25 RAG.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
            {errorMsg}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="file" className="flex items-center gap-1.5 text-xs">
              <FileUp className="w-3.5 h-3.5" /> File
            </TabsTrigger>
            <TabsTrigger value="web" className="flex items-center gap-1.5 text-xs">
              <Globe className="w-3.5 h-3.5" /> Website
            </TabsTrigger>
            <TabsTrigger value="youtube" className="flex items-center gap-1.5 text-xs">
              <Youtube className="w-3.5 h-3.5 text-red-400" /> YouTube
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> Text Note
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: FILE UPLOAD */}
          <TabsContent value="file" className="pt-3">
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-6 text-center cursor-pointer bg-secondary/20 transition-all relative">
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
                    <p className="text-sm font-medium">
                      {selectedFile ? selectedFile.name : 'Click to select or drag PDF/Docs here'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      PDF, DOCX, TXT up to 25MB (Uploaded to Cloudinary CDN)
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={!selectedFile || isLoading} className="w-full bg-primary text-primary-foreground">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Upload to Cloudinary & Index
              </Button>
            </form>
          </TabsContent>

          {/* TAB 2: WEBSITE URL (FIRECRAWL) */}
          <TabsContent value="web" className="pt-3">
            <form onSubmit={handleWebIngest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Website URL (Firecrawl Scraper)</label>
                <Input
                  placeholder="https://example.com/research-paper"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-[10px] text-muted-foreground">
                  Firecrawl converts webpage HTML into clean Markdown for high-quality chunking.
                </p>
              </div>

              <Button type="submit" disabled={!webUrl.trim() || isLoading} className="w-full bg-primary text-primary-foreground">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Crawl Website & Index
              </Button>
            </form>
          </TabsContent>

          {/* TAB 3: YOUTUBE VIDEO */}
          <TabsContent value="youtube" className="pt-3">
            <form onSubmit={handleYoutubeIngest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">YouTube Video Link</label>
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-[10px] text-muted-foreground">
                  Extracts video transcript and metadata for ParadeDB RAG indexing.
                </p>
              </div>

              <Button type="submit" disabled={!youtubeUrl.trim() || isLoading} className="w-full bg-primary text-primary-foreground">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Fetch Transcript & Index
              </Button>
            </form>
          </TabsContent>

          {/* TAB 4: TEXT NOTE */}
          <TabsContent value="text" className="pt-3">
            <form onSubmit={handleTextIngest} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Note Title</label>
                <Input
                  placeholder="e.g. Key Takeaways from Lecture 3"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Copied Text Content</label>
                <textarea
                  rows={4}
                  placeholder="Paste research text notes here..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <Button type="submit" disabled={!textTitle.trim() || !textContent.trim() || isLoading} className="w-full bg-primary text-primary-foreground">
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
