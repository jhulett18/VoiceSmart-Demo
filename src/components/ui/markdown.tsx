'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownComponentProps {
  children: string;
  className?: string;
}

export function MarkdownComponent({ children, className }: MarkdownComponentProps) {
  return (
    <div className={cn('prose prose-sm max-w-none dark:prose-invert', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
      components={{
        // Customize heading styles
        h1: ({ children }) => (
          <h1 className="text-lg font-semibold text-foreground mb-2">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold text-foreground mb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-foreground mb-1">{children}</h3>
        ),
        // Customize paragraph styles
        p: ({ children }) => (
          <p className="text-sm text-foreground leading-relaxed mb-2 last:mb-0">{children}</p>
        ),
        // Customize list styles
        ul: ({ children }) => (
          <ul className="text-sm text-foreground list-disc list-inside mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="text-sm text-foreground list-decimal list-inside mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-sm text-foreground">{children}</li>
        ),
        // Customize link styles
        a: ({ href, children }) => (
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {children}
          </a>
        ),
        // Customize emphasis styles
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-foreground">{children}</em>
        ),
        // Customize blockquote styles
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-muted-foreground/20 pl-4 italic text-muted-foreground text-sm mb-2">
            {children}
          </blockquote>
        ),
        // Customize table styles
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2">
            <table className="min-w-full text-sm border-collapse border border-muted-foreground/20">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-muted-foreground/20 px-2 py-1 bg-muted/50 font-semibold text-left">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-muted-foreground/20 px-2 py-1">
            {children}
          </td>
        ),
        // Handle inline code and code blocks
        code: ({ children, className }) => {
          // If it's a code block with language, render with CodeBlock component
          if (className?.includes('language-')) {
            const language = className.replace('language-', '');
            const CodeBlock = React.lazy(() => import('@/components/ui/code-block').then(mod => ({ default: mod.CodeBlock })));
            
            return (
              <React.Suspense fallback={<pre className="bg-muted p-4 rounded-lg overflow-x-auto"><code>{children}</code></pre>}>
                <CodeBlock language={language}>{String(children)}</CodeBlock>
              </React.Suspense>
            );
          }
          // Inline code
          return (
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
              {children}
            </code>
          );
        },
        // Pre blocks for code blocks
        pre: ({ children }) => {
          // Check if this is a code block with language
          const codeElement = React.Children.toArray(children)[0] as React.ReactElement;
          if (codeElement && codeElement.props?.className?.includes('language-')) {
            return <>{children}</>;
          }
          // Regular pre block
          return (
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap">
              {children}
            </pre>
          );
        }
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}