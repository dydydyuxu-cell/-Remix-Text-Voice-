import React, { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { allKeywords } from '../data/seoKeywords';

export function SeoSection() {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <section className="w-full bg-[#000000] border-t border-zinc-900 py-4 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* زر تكبير/تصغير الشاشة */}
        <div className="flex items-center justify-end mb-2">
          <button
            type="button"
            id="btn-toggle-screen"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer py-1 px-3 rounded bg-zinc-950 border border-zinc-900"
          >
            {isExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>تصغير الشاشة</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>تكبير الشاشة</span>
              </>
            )}
          </button>
        </div>

        {/* 5,000 كلمة دلالية مقترحة مكتوبة بجانب بعضها بلون أسمر فاتح */}
        <div
          id="seo-keywords-container"
          className={`w-full rounded-xl transition-all duration-300 overflow-y-auto select-text selection:bg-zinc-800 selection:text-white ${
            isExpanded ? 'max-h-[85vh] p-4 bg-zinc-950/80 border border-zinc-900' : 'max-h-56 p-2 bg-black'
          }`}
          style={{ backgroundColor: '#000000' }}
        >
          <p
            className="text-justify leading-relaxed text-xs font-sans"
            style={{ color: '#383838' }}
            dir="auto"
          >
            {allKeywords.join(' ')}
          </p>
        </div>
      </div>
    </section>
  );
}
