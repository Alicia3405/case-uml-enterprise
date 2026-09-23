import 'package:flutter/material.dart';

class TutorialDialog extends StatefulWidget {
  const TutorialDialog({Key? key}) : super(key: key);

  @override
  State<TutorialDialog> createState() => _TutorialDialogState();
}

class _TutorialDialogState extends State<TutorialDialog> {
  int _currentStep = 0;

  final List<Map<String, dynamic>> _steps = [
    {
      'title': '1. Asistente de Voz (Modo No-GUI)',
      'icon': Icons.record_voice_over,
      'color': Color(0xFF7C3AED),
      'desc': 'Diseñado para el docente y usuarios que prefieren interacción 100% por voz:\n\n'
          '• Canal 1 (Arquitectura IA): Di "Crear sistema para hotelería con hotel, habitación y reserva" para sintetizar todo el dominio al instante.\n'
          '• El orbe reacciona dinámicamente y la síntesis de voz (TTS) te confirma cada operación en español.',
    },
    {
      'title': '2. Comandos de Voz Atómicos',
      'icon': Icons.mic,
      'color': Color(0xFF38BDF8),
      'desc': 'Para trabajar quirúrgicamente sobre una clase o atributo específico:\n\n'
          '• "Crear clase Factura"\n'
          '• "Agregar atributo teléfono tipo String a Cliente"\n'
          '• "Agregar método calcularTotal tipo Double a Factura"\n'
          '• "Conectar Cliente con Factura"\n'
          '• "Eliminar atributo teléfono de Cliente"\n'
          '• "Limpiar lienzo" o "Deshacer"',
    },
    {
      'title': '3. Lienzo Táctil & Inspector Manual',
      'icon': Icons.pan_tool_alt,
      'color': Color(0xFF2DD4BF),
      'desc': 'Combina voz con herramientas táctiles interactivas:\n\n'
          '• Arrastra cualquier clase libremente en el lienzo infinito (5000x5000 px).\n'
          '• Toca cualquier clase para abrir su Inspector de Clase: cambia nombre, estereotipo («entity», «service»), edita atributos y métodos.\n'
          '• Usa la herramienta "Conectar" para enlazar tablas y definir multiplicidades (1..1, 0..*).',
    },
    {
      'title': '4. Descarga Backend Spring Boot ZIP',
      'icon': Icons.folder_zip,
      'color': Color(0xFFF59E0B),
      'desc': 'Generación completa de arquitectura empresarial:\n\n'
          '• Pulsa "Descargar Backend ZIP" en la barra superior.\n'
          '• Se compila en memoria un proyecto Spring Boot 3 con Java 17, JPA/Hibernate, script PostgreSQL schema.sql, controladores REST y colección Postman.\n'
          '• Descarga directa en tu navegador Chrome o dispositivo móvil.',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final step = _steps[_currentStep];

    return Dialog(
      backgroundColor: const Color(0xFF0F172A),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: Color(0xFF334155), width: 1.2),
      ),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Cabecera del paso
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: (step['color'] as Color).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(step['icon'] as IconData, color: step['color'] as Color, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    step['title'] as String,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 20),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Contenido descriptivo
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Text(
                step['desc'] as String,
                style: const TextStyle(fontSize: 12, color: Color(0xFFCBD5E1), height: 1.5),
              ),
            ),
            const SizedBox(height: 20),

            // Indicadores de paso
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_steps.length, (idx) {
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: idx == _currentStep ? 20 : 8,
                  height: 6,
                  decoration: BoxDecoration(
                    color: idx == _currentStep ? const Color(0xFF7C3AED) : const Color(0xFF334155),
                    borderRadius: BorderRadius.circular(3),
                  ),
                );
              }),
            ),
            const SizedBox(height: 18),

            // Botones Anterior / Siguiente
            Row(
              children: [
                if (_currentStep > 0)
                  TextButton(
                    onPressed: () => setState(() => _currentStep--),
                    child: const Text('Anterior', style: TextStyle(color: Color(0xFF94A3B8))),
                  ),
                const Spacer(),
                ElevatedButton(
                  onPressed: () {
                    if (_currentStep < _steps.length - 1) {
                      setState(() => _currentStep++);
                    } else {
                      Navigator.pop(context);
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF7C3AED),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text(
                    _currentStep < _steps.length - 1 ? 'Siguiente' : '¡Entendido!',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
