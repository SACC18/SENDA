import React, { useState } from 'react';

// Datos de los hitos
const hitosIniciales = [
  { id: 1, label: 'Inicio', icon: '🚩' },
  { id: 2, label: 'Matemáticas', icon: '📐' },
  { id: 3, label: 'Programación', icon: '💻' },
  { id: 4, label: 'Base de Datos', icon: '🗄️' },
  { id: 5, label: 'Proyecto Final', icon: '🏆' },
];

export default function MapPath() {
  // Estado para controlar en qué nivel va el estudiante (1 a 5)
  const [nivelActual, setNivelActual] = useState(2); 

  // Función para simular progreso (Ideal para la DEMO)
  const avanzarNivel = () => {
    setNivelActual(prev => (prev >= 5 ? 1 : prev + 1)); // Si llega al final, reinicia
  };

  return (
    <div className="relative w-full h-[400px] bg-base-100 rounded-xl overflow-hidden p-10 flex flex-col items-center justify-center border border-base-200 shadow-inner">
      
      {/* Botón "Secreto" para la Demo (Arriba a la derecha) */}
      <button 
        onClick={avanzarNivel}
        className="absolute top-4 right-4 btn btn-xs btn-ghost opacity-50 hover:opacity-100 hover:bg-base-200 z-50"
        title="Clic para simular progreso en la presentación"
      >
        ▶ Simular Progreso
      </button>

      {/* Título del Nivel Actual */}
      <div className="absolute top-6 left-0 w-full text-center animate-fade-in-up">
        <span className="text-xs uppercase tracking-widest opacity-50">Nivel Actual</span>
        <h3 className="text-2xl font-bold text-primary">
          {hitosIniciales[nivelActual - 1].label}
        </h3>
      </div>

      {/* 1. La Línea del Camino (SVG) */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        {/* Línea Base (Gris) */}
        <path 
          d="M 100,250 C 250,150 550,350 700,250" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="6" 
          className="text-base-300 opacity-30"
        />
        {/* Línea de Progreso (Coloreada) - El 'pathLength' es un truco para animar */}
        <path 
          d="M 100,250 C 250,150 550,350 700,250" 
          fill="none" 
          stroke={nivelActual === 5 ? '#36D399' : '#818CF8'} // Verde si terminó, Violeta si no
          strokeWidth="6"
          strokeDasharray="1000"
          strokeDashoffset={1000 - (nivelActual * 200)} // Calculamos cuánto pintar de la línea
          className="transition-all duration-1000 ease-out"
          style={{ filter: 'drop-shadow(0 0 4px rgba(129, 140, 248, 0.5))' }}
        />
      </svg>

      {/* 2. Los Hitos (Puntos sobre el mapa) */}
      <div className="relative w-full max-w-3xl flex justify-between items-center px-10" style={{ zIndex: 10 }}>
        {hitosIniciales.map((hito, index) => {
          const paso = index + 1;
          let estado = 'locked'; // Por defecto bloqueado

          if (paso < nivelActual) estado = 'completed';
          if (paso === nivelActual) estado = 'current';

          // Estilos Dinámicos
          let circleClass = "bg-base-300 grayscale scale-90 opacity-50"; 
          let textClass = "opacity-30";
          
          if (estado === 'completed') {
            circleClass = "bg-success text-success-content scale-100 shadow-lg ring-4 ring-success/20";
            textClass = "text-success font-bold";
          } else if (estado === 'current') {
            circleClass = "bg-primary text-primary-content scale-125 shadow-[0_0_30px_rgba(129,140,248,0.6)] ring-4 ring-primary ring-offset-2 ring-offset-base-100 animate-pulse";
            textClass = "text-primary font-bold scale-110";
          }

          return (
            <div key={hito.id} className="flex flex-col items-center gap-4 transition-all duration-500">
              
              {/* Círculo del Icono */}
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl transition-all duration-700 ${circleClass}`}>
                {estado === 'completed' ? '✅' : hito.icon}
              </div>
              
              {/* Etiqueta */}
              <span className={`text-sm transition-all duration-500 bg-base-100/80 px-2 py-1 rounded backdrop-blur-sm ${textClass}`}>
                {hito.label}
              </span>

            </div>
          );
        })}
      </div>

      {/* Mensaje de Felicitación (Solo si llega al final) */}
      {nivelActual === 5 && (
        <div className="absolute bottom-10 animate-bounce">
          <span className="badge badge-success gap-2 p-3 text-lg font-bold shadow-lg">
            🎉 ¡Semestre Completado!
          </span>
        </div>
      )}

    </div>
  );
}