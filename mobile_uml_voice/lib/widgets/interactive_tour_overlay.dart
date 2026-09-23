import 'package:flutter/material.dart';

class TourStep {
  final int tabIndex; // 0: Dashboard, 1: Voz, 2: Lienzo
  final int? subTabIndex; // 0: Mis Proyectos, 1: Colaborativos (en Dashboard)
  final int? voiceChannel; // 0: IA, 1: Comandos UML (en Voz)
  final String title;
  final String description;
  final IconData icon;
  final Color accentColor;

  const TourStep({
    required this.tabIndex,
    this.subTabIndex,
    this.voiceChannel,
    required this.title,
    required this.description,
    required this.icon,
    required this.accentColor,
  });
}

class InteractiveTourCard extends StatefulWidget {
  final Function(int tabIndex, int? subTabIndex, int? voiceChannel) onStepChanged;
  final VoidCallback onDismiss;

  const InteractiveTourCard({
    Key? key,
    required this.onStepChanged,
    required this.onDismiss,
  }) : super(key: key);

  @override
  State<InteractiveTourCard> createState() => _InteractiveTourCardState();
}

class _InteractiveTourCardState extends State<InteractiveTourCard> {
  int _currentStep = 0;

  final List<TourStep> _steps = const [
    TourStep(
      tabIndex: 0,
      subTabIndex: 0,
      title: '📁 1. Sección: Mis Proyectos',
      description: 'Esta es la sección donde están tus proyectos creados. Cada sistema que generes se guarda de forma independiente sin borrarse ni sobrescribir los anteriores.',
      icon: Icons.folder_special,
      accentColor: Color(0xFFA855F7),
    ),
    TourStep(
      tabIndex: 0,
      subTabIndex: 1,
      title: '👥 2. Proyectos Colaborativos & Invitaciones',
      description: 'Esta es la parte donde están los proyectos que trabajas con otras personas. Aquí puedes ver invitaciones recibidas de tus colegas y Aceptar o Rechazar colaborar.',
      icon: Icons.people_alt,
      accentColor: Color(0xFF38BDF8),
    ),
    TourStep(
      tabIndex: 1,
      voiceChannel: 0,
      title: '🤖 3. Generador de Arquitectura con IA',
      description: 'Aquí puedes generar con IA directamente la arquitectura completa sintetizada dictando por voz (ej. "Crear sistema para clínica veterinaria").',
      icon: Icons.auto_awesome,
      accentColor: Color(0xFF7C3AED),
    ),
    TourStep(
      tabIndex: 1,
      voiceChannel: 1,
      title: '⚡ 4. Comandos de Voz Específicos UML',
      description: 'Aquí puedes ir por sección de tabla o más detallado en algo específico: dictar "crear tabla cliente", "agregar atributo teléfono a cliente" o "conectar clases".',
      icon: Icons.mic,
      accentColor: Color(0xFF2DD4BF),
    ),
    TourStep(
      tabIndex: 2,
      title: '🎨 5. Lienzo UML Interactivo & Backend ZIP',
      description: 'Visualiza tu proyecto, mueve las tablas en un lienzo infinito, edita clases con doble toque y descarga el código fuente Spring Boot 3 completo en ZIP.',
      icon: Icons.hub_outlined,
      accentColor: Color(0xFFF59E0B),
    ),
    TourStep(
      tabIndex: 2,
      title: '📷 6. Escáner Vision AI (Cámara & Galería)',
      description: 'Usa el botón de escáner en la barra superior para tomar una foto a tu pizarra o subir un boceto. La IA digitaliza las tablas organizándolas en grilla 2D sin encimarse.',
      icon: Icons.document_scanner_outlined,
      accentColor: Color(0xFFA855F7),
    ),
    TourStep(
      tabIndex: 2,
      title: '🏛️ 7. Enterprise Architect XMI & Candados',
      description: 'Exporta e importa archivos XMI 2.1 compatibles con Sparx Systems Enterprise Architect. Además, el candado colaborativo evita que dos usuarios modifiquen la misma tabla a la vez.',
      icon: Icons.lock_person_outlined,
      accentColor: Color(0xFF10B981),
    ),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _applyStep(0);
    });
  }

  void _applyStep(int index) {
    final step = _steps[index];
    widget.onStepChanged(step.tabIndex, step.subTabIndex, step.voiceChannel);
  }

  void _next() {
    if (_currentStep < _steps.length - 1) {
      setState(() => _currentStep++);
      _applyStep(_currentStep);
    } else {
      widget.onDismiss();
    }
  }

  void _prev() {
    if (_currentStep > 0) {
      setState(() => _currentStep--);
      _applyStep(_currentStep);
    }
  }

  @override
  Widget build(BuildContext context) {
    final step = _steps[_currentStep];
    final isLast = _currentStep == _steps.length - 1;

    return Positioned(
      bottom: 75,
      left: 16,
      right: 16,
      child: Material(
        color: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A).withOpacity(0.96),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: step.accentColor, width: 1.8),
            boxShadow: [
              BoxShadow(
                color: step.accentColor.withOpacity(0.35),
                blurRadius: 20,
                spreadRadius: 2,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Barra superior del tutorial: Icono, Título y Botón Cerrar/Saltar
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: step.accentColor.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(step.icon, color: step.accentColor, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          step.title,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        Text(
                          'Paso ${_currentStep + 1} de ${_steps.length}',
                          style: TextStyle(fontSize: 11, color: step.accentColor, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: widget.onDismiss,
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFF94A3B8),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    ),
                    child: const Text('Saltar ✕', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Descripción guiada
              Text(
                step.description,
                style: const TextStyle(fontSize: 12, color: Color(0xFFCBD5E1), height: 1.4),
              ),
              const SizedBox(height: 14),

              // Indicadores de Progreso y Botones de Navegación
              Row(
                children: [
                  // Indicadores de bolitas
                  Row(
                    children: List.generate(_steps.length, (i) {
                      final isActive = i == _currentStep;
                      return Container(
                        margin: const EdgeInsets.only(right: 5),
                        width: isActive ? 16 : 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: isActive ? step.accentColor : const Color(0xFF334155),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      );
                    }),
                  ),
                  const Spacer(),

                  // Botón Anterior
                  if (_currentStep > 0)
                    TextButton(
                      onPressed: _prev,
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF94A3B8),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      ),
                      child: const Text('Anterior', style: TextStyle(fontSize: 12)),
                    ),

                  const SizedBox(width: 6),

                  // Botón Siguiente / Empezar
                  ElevatedButton(
                    onPressed: _next,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: step.accentColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      elevation: 4,
                    ),
                    child: Text(
                      isLast ? '¡Empezar a Diseñar!' : 'Siguiente ➔',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
