"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const mdComponents: Components = {
  h1: ({ children }) => <h1 className="ao-md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="ao-md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="ao-md-h3">{children}</h3>,
  p: ({ children }) => <p className="ao-md-p">{children}</p>,
  ul: ({ children }) => <ul className="ao-md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="ao-md-ol">{children}</ol>,
  li: ({ children }) => <li className="ao-md-li">{children}</li>,
  strong: ({ children }) => <strong className="ao-md-strong">{children}</strong>,
  em: ({ children }) => <em className="ao-md-em">{children}</em>,
  pre: ({ children }) => <pre className="ao-md-pre">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="ao-md-blockquote">{children}</blockquote>
  ),
  hr: () => <hr className="ao-md-hr" />,
  a: ({ href, children }) => (
    <a className="ao-md-a" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="ao-md-table-wrap">
      <table className="ao-md-table">{children}</table>
    </div>
  ),
};

export function AoMessageMarkdown({ text }: { text: string }) {
  return (
    <div className="ao-md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
