"use client"

import { useState } from "react"
import { Lightbulb, HelpCircle } from "lucide-react"
import { TutorialsModal } from "@/components/tutorials-modal"
import { useUI } from "@/lib/ui-context"

export default function HomePage() {
  const [tutorialsOpen, setTutorialsOpen] = useState(false)
  const { toggleSidebar } = useUI()

  const handleBackgroundClick = () => {
    toggleSidebar()
  }

  return (
    <div className="relative h-full min-h-screen w-full overflow-hidden">
      {/* Full-bleed hero background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url("/background.jpg")',
        }}
      />
      {/* Dark overlay for depth - also handles click to toggle sidebar */}
      <div
        onClick={handleBackgroundClick}
        className="absolute inset-0 bg-black/30 cursor-pointer"
      />

      {/* Tutorial button - top right */}
      <div className="absolute top-5 right-5 z-10">
        <button
          type="button"
          onClick={() => setTutorialsOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2d5a3d] hover:bg-[#3a6f4e] text-[#f5f0e8] text-sm font-medium transition-colors shadow-lg"
        >
          <Lightbulb className="h-4 w-4" />
          <span>Tutorial</span>
        </button>
      </div>

      {/* Help button - bottom right */}
      <div className="absolute bottom-5 right-5 z-10">
        <button
          type="button"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[#f5f0e8] hover:bg-[#e8e0d0] text-[#2d5a3d] shadow-lg transition-colors"
          aria-label="Ayuda"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>

      <TutorialsModal open={tutorialsOpen} onOpenChange={setTutorialsOpen} />
    </div>
  )
}
