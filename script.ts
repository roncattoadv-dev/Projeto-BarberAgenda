import fs from 'fs';

let content = fs.readFileSync('src/components/SaaSArchitect.tsx', 'utf-8');

const replacements = [
  ['bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl', 'bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm'],
  ['bg-slate-900/80 backdrop-blur-md px-2 py-2 border border-slate-700/50 rounded-full flex gap-2 overflow-x-auto max-w-full shadow-sm ring-1 ring-slate-950/50 no-scrollbar', 'bg-slate-50 border border-slate-200 rounded-full flex gap-2 overflow-x-auto max-w-full shadow-sm p-2 no-scrollbar mx-4 mt-4'],
  ['bg-teal-500 text-slate-950', 'bg-blue-600 text-white'],
  ['text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 scale-95 hover:scale-100', 'text-slate-500 hover:bg-slate-100 scale-95 hover:scale-100 font-medium'],
  ['text-teal-400 font-mono tracking-widest font-bold', 'text-blue-600 tracking-widest font-bold'],
  ['text-slate-350 mt-1.5 leading-relaxed', 'text-slate-500 mt-1.5 leading-relaxed font-medium text-sm'],
  
  // Convert standard dark boxes
  ['bg-slate-950 p-5 rounded-xl border border-slate-800', 'bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm'],
  ['bg-slate-950 p-6 rounded-xl border border-slate-800', 'bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm'],
  ['bg-slate-950 p-4 rounded-xl border border-slate-800', 'bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm'],
  
  ['bg-slate-900/60 p-4 rounded-lg border border-slate-800', 'bg-white p-4 rounded-xl border border-slate-200 shadow-sm'],
  ['text-slate-300 font-semibold', 'text-slate-900 font-extrabold'],
  ['text-slate-200 uppercase tracking-wider', 'text-slate-900 uppercase tracking-widest font-bold'],
  ['text-slate-450 text-[10px] leading-relaxed', 'text-slate-500 text-[11px] leading-relaxed font-medium'],
  ['text-emerald-400', 'text-emerald-600'],
  ['text-teal-400', 'text-blue-600'],
  ['text-slate-100', 'text-slate-900'],
  ['text-slate-400', 'text-slate-500'],
  ['text-slate-300', 'text-slate-700'],
  
  // Specific blocks in Monetizacao
  ['text-3xl font-extrabold text-slate-100 font-mono', 'text-3xl font-extrabold text-slate-900 tracking-tight'],
  ['border-slate-850', 'border-slate-200'],
  ['bg-slate-900 duration-200 p-5 rounded-lg border border-slate-800', 'bg-white duration-200 p-5 rounded-xl border border-slate-100 shadow-sm'],
  ['text-indigo-400', 'text-indigo-600']
];

for (const [oldStr, newStr] of replacements) {
    // using split join for replaceAll functionality globally
    content = content.split(oldStr).join(newStr);
}

// Special cases that need regex or more global replacements
content = content.replace(/bg-slate-9[0-5]0/g, 'bg-slate-50');
content = content.replace(/border-slate-8[0-5]0/g, 'border-slate-200');
content = content.replace(/text-slate-400/g, 'text-slate-500');
content = content.replace(/text-slate-300/g, 'text-slate-700');
content = content.replace(/text-slate-200/g, 'text-slate-900');
content = content.replace(/text-slate-100/g, 'text-slate-900');

fs.writeFileSync('src/components/SaaSArchitect.tsx', content);
console.log('Done replacement');
