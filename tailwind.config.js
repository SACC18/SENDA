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
    // Aquí definimos manualmente los colores para asegurar que se vean bien
    themes: [
      "nord", // Este es el claro que te gustó (no lo tocamos)
      
      {
        dim: {
          // Tu versión corregida de "Oscuro"
          "primary": "#818CF8",   // Un violeta suave (Indigo)
          "secondary": "#60A5FA", // Azul cielo mate
          "accent": "#37CDBE",    
          "neutral": "#1f2937",   // Gris oscuro mate
          "base-100": "#111827",  // Fondo casi negro (muy descansado para la vista)
          "info": "#3ABFF8",
          "success": "#36D399",
          "warning": "#FBBD23",
          "error": "#F87272",
        },
        
        bumblebee: {
          // Tu versión corregida de "Alto Contraste" (Accesibilidad Real)
          "primary": "#FFFF00",   // Amarillo Puro
          "secondary": "#FFFF00",
          "accent": "#FFFFFF",
          "neutral": "#333333",
          "base-100": "#000000",  // Fondo NEGRO PURO
          "base-content": "#FFFF00", // Texto Amarillo por defecto
          "info": "#5555FF",
          "success": "#00FF00",
          "warning": "#FFA500",
          "error": "#FF0000",
        }
      }
    ],
  },
}