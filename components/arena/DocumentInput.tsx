"use client";

import { useState, useCallback } from "react";
import { FileText, Link, Type, CheckCircle, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FileUpload";

export interface LoadedDocument {
  id: string;
  name: string;
  source: "pdf" | "url" | "text";
  content: string;
  wordCount: number;
}

interface DocumentInputProps {
  onDocumentLoaded: (content: string, name: string, source: string) => void;
  onDocumentsChange?: (documents: LoadedDocument[]) => void;
  multiple?: boolean;
}

export function DocumentInput({
  onDocumentLoaded,
  onDocumentsChange,
  multiple = true
}: DocumentInputProps) {
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<LoadedDocument[]>([]);

  const addDocument = useCallback((doc: LoadedDocument) => {
    const updatedDocs = multiple ? [...documents, doc] : [doc];
    setDocuments(updatedDocs);
    onDocumentsChange?.(updatedDocs);
    // Also call the legacy single-doc callback with combined content
    const combinedContent = updatedDocs.map(d => d.content).join("\n\n---\n\n");
    const combinedName = updatedDocs.map(d => d.name).join(", ");
    onDocumentLoaded(combinedContent, combinedName, doc.source);
  }, [documents, multiple, onDocumentsChange, onDocumentLoaded]);

  const removeDocument = useCallback((id: string) => {
    const updatedDocs = documents.filter(d => d.id !== id);
    setDocuments(updatedDocs);
    onDocumentsChange?.(updatedDocs);
    if (updatedDocs.length > 0) {
      const combinedContent = updatedDocs.map(d => d.content).join("\n\n---\n\n");
      const combinedName = updatedDocs.map(d => d.name).join(", ");
      onDocumentLoaded(combinedContent, combinedName, updatedDocs[0].source);
    }
  }, [documents, onDocumentsChange, onDocumentLoaded]);

  const clearAllDocuments = useCallback(() => {
    setDocuments([]);
    onDocumentsChange?.([]);
  }, [onDocumentsChange]);

  const handlePdfUpload = async (file: File) => {
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/document/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload file");
      }

      const data = await response.json();
      addDocument({
        id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: data.name,
        source: "pdf",
        content: data.content,
        wordCount: data.wordCount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setLoading(false);
    }
  };

  const handleUrlFetch = async () => {
    if (!urlInput.trim()) {
      setError("Please enter a URL");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/document/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch URL");
      }

      const data = await response.json();
      addDocument({
        id: `url-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: data.name,
        source: "url",
        content: data.content,
        wordCount: data.wordCount,
      });
      setUrlInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch URL");
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) {
      setError("Please enter some text");
      return;
    }

    setError(null);
    const wordCount = textInput.split(/\s+/).filter((w) => w).length;
    addDocument({
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: "Pasted Text",
      source: "text",
      content: textInput,
      wordCount,
    });
    setTextInput("");
  };

  const totalWordCount = documents.reduce((sum, d) => sum + d.wordCount, 0);

  // Show loaded documents summary
  if (documents.length > 0) {
    return (
      <div className="space-y-3">
        {/* Documents list */}
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="font-medium text-green-700 dark:text-green-300 text-sm">
              {documents.length} document{documents.length > 1 ? "s" : ""} loaded ({totalWordCount.toLocaleString()} words total)
            </span>
          </div>

          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-green-100 dark:border-green-900"
              >
                <FileText className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">
                    {doc.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {doc.wordCount.toLocaleString()} words • {doc.source.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => removeDocument(doc.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove document"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add more or clear */}
        <div className="flex items-center gap-2">
          {multiple && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllDocuments}
              className="flex-1"
            >
              Clear All
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDocuments([])}
            className="flex-1"
          >
            {multiple ? "Add More" : "Change"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="pdf">
        <TabsList>
          <TabsTrigger value="pdf">
            <FileText className="w-4 h-4 mr-2" />
            PDF Upload
          </TabsTrigger>
          <TabsTrigger value="url">
            <Link className="w-4 h-4 mr-2" />
            URL
          </TabsTrigger>
          <TabsTrigger value="text">
            <Type className="w-4 h-4 mr-2" />
            Paste Text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pdf" className="min-h-[200px]">
          <FileUpload onUpload={handlePdfUpload} multiple={multiple} />
        </TabsContent>

        <TabsContent value="url" className="min-h-[200px]">
          <div className="flex flex-col h-[200px]">
            <div className="flex-1 flex flex-col justify-center">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/document"
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Enter a URL to fetch document content
              </p>
            </div>
            <Button onClick={handleUrlFetch} loading={loading} className="w-full mt-3">
              Fetch Content
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="text" className="min-h-[200px]">
          <div className="flex flex-col h-[200px]">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste your document content here..."
              className="flex-1 w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
            <Button onClick={handleTextSubmit} className="w-full mt-3">
              Use This Text
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
