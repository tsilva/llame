"use client";

import React, { useState } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { Copy, Check } from "lucide-react";

// Import highlight.js styles
import "highlight.js/styles/github-dark.css";
// Import KaTeX styles for math rendering
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  muted?: boolean;
}

// Code block component with copy functionality
const CodeBlock: React.FC<{
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  muted?: boolean;
}> = ({ inline, className, children, muted }) => {
  const [copied, setCopied] = useState(false);

  if (inline) {
    return (
      <code className={`px-1.5 py-0.5 rounded bg-white/10 text-sm font-mono ${muted ? "text-[#5e5e5e]" : "text-[#10a37f]"}`}>
        {children}
      </code>
    );
  }

  const handleCopy = async () => {
    const code = String(children).replace(/\n$/, "");
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden bg-[#1a1a1a] border border-white/[0.08]">
      <div className="flex items-center justify-between px-3 py-2 bg-[#252525] border-b border-white/[0.08]">
        <span className="text-xs text-[#8e8e8e] font-mono">
          {className ? className.replace("language-", "") : "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#8e8e8e] hover:text-white hover:bg-white/10 transition-colors"
        >
          {copied ? (
            <>
              <Check size={12} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 sm:p-4 overflow-x-auto">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
};

export function MarkdownRenderer({ content, isStreaming, muted }: MarkdownRendererProps) {
  // Configure custom components for markdown rendering
  const components: Components = {
    code: (props) => <CodeBlock {...props} muted={muted} />,
    h1: ({ children }) => (
      <h1 className={`text-xl font-semibold mt-6 mb-4 border-b pb-2 ${muted ? "text-[#6e6e6e] border-white/[0.04]" : "text-white border-white/[0.08]"}`}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className={`text-lg font-semibold mt-5 mb-3 ${muted ? "text-[#6e6e6e]" : "text-white"}`}>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className={`text-base font-semibold mt-4 mb-2 ${muted ? "text-[#6e6e6e]" : "text-white"}`}>
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className={`text-sm font-semibold mt-3 mb-2 ${muted ? "text-[#6e6e6e]" : "text-white"}`}>
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className={`mb-4 leading-7 ${muted ? "text-[#6e6e6e]" : "text-[#ececec]"}`}>
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className={`mb-4 ml-3 sm:ml-4 list-disc ${muted ? "text-[#6e6e6e]" : "text-[#ececec]"}`}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={`mb-4 ml-3 sm:ml-4 list-decimal ${muted ? "text-[#6e6e6e]" : "text-[#ececec]"}`}>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="mb-1 leading-7">
        {children}
      </li>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={muted ? "text-[#5e5e5e] hover:underline" : "text-[#10a37f] hover:underline"}
      >
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <blockquote className={`border-l-4 pl-4 my-4 italic ${muted ? "border-[#4e4e4e] text-[#5e5e5e]" : "border-[#10a37f] text-[#b4b4b4]"}`}>
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-white/[0.08] rounded-lg">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className={muted ? "bg-[#1a1a1a]" : "bg-[#2a2a2a]"}>
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th className={`px-2 py-1.5 sm:px-4 sm:py-2 text-left text-sm font-semibold border border-white/[0.08] ${muted ? "text-[#6e6e6e]" : "text-white"}`}>
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className={`px-2 py-1.5 sm:px-4 sm:py-2 text-sm border border-white/[0.08] ${muted ? "text-[#6e6e6e]" : "text-[#ececec]"}`}>
        {children}
      </td>
    ),
    hr: () => (
      <hr className="my-6 border-white/[0.08]" />
    ),
    strong: ({ children }) => (
      <strong className={`font-semibold ${muted ? "text-[#7e7e7e]" : "text-white"}`}>
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className={`italic ${muted ? "text-[#5e5e5e]" : "text-[#b4b4b4]"}`}>
        {children}
      </em>
    ),
    del: ({ children }) => (
      <del className={`line-through ${muted ? "text-[#4e4e4e]" : "text-[#8e8e8e]"}`}>
        {children}
      </del>
    ),
    input: ({ checked, type }) => {
      if (type === "checkbox") {
        return (
          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="mr-2 accent-[#10a37f]"
          />
        );
      }
      return <input type={type} />;
    },
  };

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
      {Boolean(isStreaming) && (
        <span key="cursor" className="inline-block w-2 h-2 ml-1 bg-white rounded-full animate-cursor-pulse" />
      )}
    </div>
  );
}
