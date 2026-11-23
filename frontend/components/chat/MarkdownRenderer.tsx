/**
 * ============================================================
 * RENDU MARKDOWN LÉGER — Sans dépendance externe
 * ============================================================
 *
 * Convertit le Markdown basique en JSX React.
 * Gère : gras, italique, listes, liens, retours à la ligne.
 *
 * Pourquoi pas react-markdown ?
 *  → Pour éviter une dépendance supplémentaire dans le bundle.
 *  → Le Markdown utilisé par le LLM est simple (pas de tableaux,
 *    pas de code blocks complexes).
 */

import React from "react";

interface MarkdownRendererProps {
  /** Texte Markdown à convertir */
  content: string;
  /** Classes CSS optionnelles */
  className?: string;
}

/**
 * Parse une ligne de texte en éléments React,
 * en gérant le gras (**) et l'italique (*).
 */
function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Regex pour capturer **gras** et *italique*
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

  parts.forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      // Texte en gras
      nodes.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    } else if (part.startsWith("*") && part.endsWith("*")) {
      // Texte en italique
      nodes.push(
        <em key={`${keyPrefix}-i-${i}`}>{part.slice(1, -1)}</em>
      );
    } else if (part) {
      nodes.push(<span key={`${keyPrefix}-t-${i}`}>{part}</span>);
    }
  });

  return nodes;
}

/**
 * Composant principal de rendu Markdown.
 * Découpe le contenu en blocs (paragraphes, listes)
 * et applique le formatage inline.
 */
export default function MarkdownRenderer({
  content,
  className = "",
}: MarkdownRendererProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  /** Flush la liste en cours dans blocks */
  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType;
      blocks.push(
        <ListTag
          key={`list-${blocks.length}`}
          className={`mb-2 space-y-1 pl-4 ${listType === "ul" ? "list-disc" : "list-decimal"}`}
        >
          {listItems}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // Ligne vide → fin de paragraphe
    if (!trimmed) {
      flushList();
      return;
    }

    // Liste à puces : "- item" ou "• item"
    if (/^[-•]\s/.test(trimmed)) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(
        <li key={`li-${lineIdx}`}>
          {parseInline(trimmed.replace(/^[-•]\s/, ""), `li-${lineIdx}`)}
        </li>
      );
      return;
    }

    // Liste numérotée : "1. item"
    if (/^\d+\.\s/.test(trimmed)) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(
        <li key={`oli-${lineIdx}`}>
          {parseInline(trimmed.replace(/^\d+\.\s/, ""), `oli-${lineIdx}`)}
        </li>
      );
      return;
    }

    // Texte normal → paragraphe
    flushList();
    blocks.push(
      <p key={`p-${lineIdx}`} className="mb-1.5 last:mb-0">
        {parseInline(trimmed, `p-${lineIdx}`)}
      </p>
    );
  });

  // Flush final
  flushList();

  return (
    <div className={`text-sm leading-relaxed ${className}`}>{blocks}</div>
  );
}
