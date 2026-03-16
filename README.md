# proyecto-vision
Proyecto mitad de semestre visión artificial. Pascualtobias Rendon

Este es el proyecto de mitad de semestre para la asignatura de Visión Artificial. El sistema procesa video en tiempo real para generar un campo de partículas reactivo basado en el movimiento del usuario.

Concepto
La aplicación utiliza la técnica de Frame Differencing para transformar la actividad física frente a la cámara en fuerzas dinámicas. El sistema analiza el flujo de movimiento para influir en el color, tamaño y dirección de cientos de partículas, creando una experiencia visual generativa.

🛠️ Especificaciones Técnicas
Detección de Movimiento: Comparación de píxeles mediante un buffer de frames (Uint8ClampedArray) para aislar cambios en la escena.

Grilla de Flujo: El canvas se divide en celdas de 16px que calculan vectores de dirección local (dx, dy) para empujar las partículas de forma orgánica.

Sistema de Estados: El comportamiento visual transiciona entre estados (Quieto, Lento, Medio, Rápido) basándose en la intensidad acumulada del movimiento.

Renderizado: Uso de una capa secundaria (createGraphics) para generar efectos de Aura con brillo acumulativo y color en modo HSB.

🕹️ Interacción
Particles: Ajusta la densidad de la simulación.

Threshold: Calibra la sensibilidad de detección según la iluminación ambiental.

🚀 Tecnologías
p5.js
