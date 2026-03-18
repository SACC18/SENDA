/** @type {import('tailwindcss').Config} */
import daisyui from "daisyui"

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    daisyui,
  ],
  daisyui: {
    themes: [
      "nord",
      
      {
        dim: {
          "primary": "#818CF8",   
          "secondary": "#60A5FA", 
          "accent": "#37CDBE",    
          "neutral": "#1f2937",   
          "base-100": "#111827",  
          "info": "#3ABFF8",
          "success": "#36D399",
          "warning": "#FBBD23",
          "error": "#F87272",
          "--rounded-btn": "1.9rem",
        },
        
        bumblebee: {
          "primary": "#FFFF00",   
          "secondary": "#FFFF00",
          "accent": "#FFFFFF",
          "neutral": "#333333",
          "base-100": "#000000",  
          "base-content": "#FFFF00", 
          "info": "#5555FF",
          "success": "#00FF00",
          "warning": "#FFA500",
          "error": "#FF0000",
          "--rounded-btn": "1.9rem",
        }
      }
    ],
  },
}