'use client';

import React, { useState, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMemorybookStore } from '@/store/useMemorybookStore';
import { ChevronDown, Plus, BookOpen, Check, Trash2, Search } from 'lucide-react';

export function MemorybookSwitcher() {
  const { memorybooks, activeMemorybook, setActiveMemorybook, setCreateModalOpen, deleteMemorybook } =
    useMemorybookStore();
  const [search, setSearch] = useState('');

  const filteredMemorybooks = useMemo(() => {
    if (!search.trim()) return memorybooks;
    return memorybooks.filter((n) =>
      n.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [memorybooks, search]);

  return (
    <div className="flex items-center space-x-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="h-8.5 px-3 bg-muted/40 hover:bg-muted/70 text-foreground text-xs font-semibold max-w-[240px] flex items-center justify-between gap-2 shadow-2xs border-0 rounded-2xl transition-colors duration-150"
          >
            <div className="flex items-center gap-1.5 truncate">
              <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">
                {activeMemorybook ? activeMemorybook.title : 'Select Workspace'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-[300px] z-[150] bg-card text-card-foreground border-0 shadow-2xl p-2 rounded-3xl"
        >
          <div className="p-2 space-y-2">
            <div className="flex items-center justify-between">
              <DropdownMenuLabel className="text-xs font-bold text-foreground p-0">
                Workspaces ({memorybooks.length})
              </DropdownMenuLabel>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                + New
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search workspaces..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 bg-muted/30 border-0 text-xs h-8 rounded-xl placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <DropdownMenuSeparator className="bg-transparent my-0.5" />

          <div className="max-h-[220px] overflow-y-auto space-y-1 py-1 px-1">
            {memorybooks.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No workspaces found. Click below to create one!
              </div>
            ) : filteredMemorybooks.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No matches for "{search}"
              </div>
            ) : (
              filteredMemorybooks.map((nb) => {
                const isActive = activeMemorybook?.id === nb.id;
                return (
                  <DropdownMenuItem
                    key={nb.id}
                    onClick={() => setActiveMemorybook(nb)}
                    className={`flex items-center justify-between group cursor-pointer p-2.5 rounded-xl transition-colors duration-150 ${
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                      <BookOpen
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                      <div className="truncate min-w-0">
                        <p className="text-xs truncate">{nb.title}</p>
                        {nb.description && (
                          <p className="text-[10px] text-muted-foreground truncate font-normal">
                            {nb.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      {isActive && <Check className="w-3.5 h-3.5 text-primary" />}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete workspace "${nb.title}"?`)) {
                            deleteMemorybook(nb.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity text-muted-foreground"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </div>

          <DropdownMenuSeparator className="bg-transparent my-0.5" />

          <DropdownMenuItem
            onClick={() => setCreateModalOpen(true)}
            className="text-primary focus:text-primary cursor-pointer gap-2 font-semibold p-2.5 bg-primary/5 hover:bg-primary/10 rounded-2xl justify-center"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span className="text-xs">Create New Workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="sm"
        onClick={() => setCreateModalOpen(true)}
        className="h-8.5 text-xs bg-primary text-primary-foreground font-semibold px-3 rounded-2xl border-0 shadow-xs gap-1 hidden sm:flex"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>New Workspace</span>
      </Button>
    </div>
  );
}
