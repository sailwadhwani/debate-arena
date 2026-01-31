import { DebateArena } from "@/components/arena/DebateArena";
import Link from "next/link";
import { Settings } from "lucide-react";

export default function DebatePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">DA</span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">
                Debate Arena
              </span>
            </div>

            <nav className="flex items-center gap-4">
              <Link
                href="/agents"
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4" />
                Configure Agents
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DebateArena />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Multi-Agent AI Debate Platform - Powered by ReAct Framework
          </p>
        </div>
      </footer>
    </div>
  );
}
