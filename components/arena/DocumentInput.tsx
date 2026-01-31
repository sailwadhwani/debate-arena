"use client";

import { useState } from "react";
import { FileText, Link, Type, CheckCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FileUpload";

interface DocumentInputProps {
  onDocumentLoaded: (content: string, name: string, source: string) => void;
}

export function DocumentInput({ onDocumentLoaded }: DocumentInputProps) {
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{
    name: string;
    source: string;
    wordCount: number;
  } | null>(null);

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
      setLoaded({
        name: data.name,
        source: "pdf",
        wordCount: data.wordCount,
      });
      onDocumentLoaded(data.content, data.name, "pdf");
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
      setLoaded({
        name: data.name,
        source: "url",
        wordCount: data.wordCount,
      });
      onDocumentLoaded(data.content, data.name, "url");
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
    setLoaded({
      name: "Pasted Text",
      source: "text",
      wordCount,
    });
    onDocumentLoaded(textInput, "Pasted Text", "text");
  };

  if (loaded) {
    return (
      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <div className="font-medium text-green-700 dark:text-green-300">
              Document Loaded
            </div>
            <div className="text-sm text-green-600 dark:text-green-400">
              {loaded.name} ({loaded.wordCount.toLocaleString()} words)
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLoaded(null)}
          >
            Change
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

        <TabsContent value="pdf">
          <FileUpload onUpload={handlePdfUpload} />
        </TabsContent>

        <TabsContent value="url">
          <div className="space-y-3">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/document"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <Button onClick={handleUrlFetch} loading={loading} className="w-full">
              Fetch Content
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="text">
          <div className="space-y-3">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste your document content here..."
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <Button onClick={handleTextSubmit} className="w-full">
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
