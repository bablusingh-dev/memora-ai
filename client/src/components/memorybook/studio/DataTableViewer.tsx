'use client';

import React, { useMemo, useState } from 'react';
import { Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DataTablePayload } from '@/types/api';

interface DataTableViewerProps {
  payload: DataTablePayload;
}

/**
 * Plain sortable/searchable HTML table — no new dependency needed for this
 * (unlike Mind Map/Slide Deck, which will warrant one). Click a column
 * header to sort by it; the search box filters rows across all columns.
 */
export function DataTableViewer({ payload }: DataTableViewerProps) {
  const { columns, rows } = payload;
  const [query, setQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = q ? rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q))) : rows;

    if (sortColumn !== null) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortColumn] ?? '';
        const bVal = b[sortColumn] ?? '';
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        const cmp =
          !isNaN(aNum) && !isNaN(bNum) && aVal.trim() !== '' && bVal.trim() !== ''
            ? aNum - bNum
            : aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, query, sortColumn, sortDirection]);

  const toggleSort = (colIndex: number) => {
    if (sortColumn !== colIndex) {
      setSortColumn(colIndex);
      setSortDirection('asc');
    } else {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    }
  };

  return (
    <div className="flex flex-col space-y-3">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
        <Input
          placeholder="Filter rows..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8 bg-muted/40 border-0 text-xs h-8 rounded-xl placeholder:text-muted-foreground"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40">
              {columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => toggleSort(i)}
                  className="text-left px-3 py-2 font-bold text-foreground cursor-pointer select-none hover:bg-muted/70 transition-colors duration-150 whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1">
                    {col}
                    {sortColumn === i ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">
                  No matching rows.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, rIdx) => (
                <tr key={rIdx} className="border-t border-border/40 hover:bg-muted/20 transition-colors duration-150">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-foreground/90 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground text-right">
        {filteredRows.length} / {rows.length} rows
      </p>
    </div>
  );
}
