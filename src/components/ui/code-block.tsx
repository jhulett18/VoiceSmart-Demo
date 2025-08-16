'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  language?: string;
  children: string;
  className?: string;
}

// Dynamic import for Shiki to avoid SSR issues
const loadShiki = async () => {
  const { codeToHtml } = await import('shiki');
  return { codeToHtml };
};

export function CodeBlock({ language = 'text', children, className }: CodeBlockProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const highlightCode = async () => {
      try {
        const { codeToHtml } = await loadShiki();
        
        const html = await codeToHtml(children, {
          lang: language,
          theme: 'github-dark',
          transformers: [
            {
              pre(node) {
                // Remove default styles and add our own
                node.properties.style = '';
                node.properties.class = 'shiki-pre';
              },
              code(node) {
                node.properties.class = 'shiki-code';
              }
            }
          ]
        });
        
        setHighlightedCode(html);
      } catch (error) {
        console.warn('Failed to highlight code:', error);
        // Fallback to plain text
        setHighlightedCode(`<pre><code>${children}</code></pre>`);
      } finally {
        setIsLoading(false);
      }
    };

    highlightCode();
  }, [children, language]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('relative bg-muted/50 rounded-lg p-4 mb-4', className)}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-mono">
            {language}
          </span>
          <div className="w-8 h-8 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative bg-gray-950 rounded-lg mb-4 overflow-hidden', className)}>
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-300 font-mono">
          {language}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyToClipboard}
          className="h-8 w-8 p-0 text-gray-300 hover:text-white hover:bg-gray-700"
        >
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Code content */}
      <div className="p-4 overflow-x-auto">
        <div 
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
          style={{
            // Override Shiki's default styles
            background: 'transparent',
            color: 'inherit'
          }}
        />
      </div>

      {/* Custom styles for Shiki output */}
      <style jsx>{`
        :global(.shiki-pre) {
          background: transparent !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
        }
        :global(.shiki-code) {
          background: transparent !important;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
          font-size: 0.875rem !important;
          line-height: 1.5 !important;
        }
      `}</style>
    </div>
  );
}