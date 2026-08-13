'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useNotebookStore } from '@/store/useNotebookStore';
import { ChevronDown, Plus, BookOpen, Check, Trash2 } from 'lucide-react';

export function NotebookSwitcher() {
  const { notebooks, activeNotebook, setActiveNotebook, setCreateModalOpen, deleteNotebook } = useNotebookStore();

  return (
    <div className="flex items-center space-x-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-9 px-3 bg-secondary/40 border-border hover:bg-secondary/70 text-xs font-medium max-w-[240px] flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-1.5 truncate">
              <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{activeNotebook ? activeNotebook.title : 'Select Notebook'}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[280px]">
          <DropdownMenuLabel>My Notebooks ({notebooks.length})</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <div className="max-h-[220px] overflow-y-auto">
            {notebooks.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No notebooks found. Create one to get started!
              </div>
            ) : (
              notebooks.map((nb) => {
                const isActive = activeNotebook?.id === nb.id;
                return (
                  <DropdownMenuItem
                    key={nb.id}
                    onClick={() => setActiveNotebook(nb)}
                    className="flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <BookOpen className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-xs truncate ${isActive ? 'font-semibold text-primary' : ''}`}>
                        {nb.title}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {isActive && <Check className="w-3.5 h-3.5 text-primary" />}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete notebook "${nb.title}"?`)) {
                            deleteNotebook(nb.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setCreateModalOpen(true)}
            className="text-primary focus:text-primary cursor-pointer gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium text-xs">Create New Notebook</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="sm"
        onClick={() => setCreateModalOpen(true)}
        className="h-9 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"
      >
        <Plus className="w-3.5 h-3.5 mr-1" /> New Notebook
      </Button>
    </div>
  );
}
