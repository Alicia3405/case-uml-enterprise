import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/uml_models.dart';
import '../providers/project_provider.dart';
import '../services/file_picker_helper.dart';
import '../services/uml_vision_ai_service.dart';

class VisionScannerSheet extends StatefulWidget {
  const VisionScannerSheet({Key? key}) : super(key: key);

  @override
  State<VisionScannerSheet> createState() => _VisionScannerSheetState();
}

class _VisionScannerSheetState extends State<VisionScannerSheet> {
  String? _imageBase64;
  bool _isAnalyzing = false;
  final TextEditingController _hintCtrl = TextEditingController();

  Future<void> _pickFromCamera() async {
    final res = await pickImageWeb(captureCamera: true);
    if (res != null) {
      setState(() => _imageBase64 = res);
    }
  }

  Future<void> _pickFromGallery() async {
    final res = await pickImageWeb(captureCamera: false);
    if (res != null) {
      setState(() => _imageBase64 = res);
    }
  }

  void _loadSampleSketch() {
    setState(() {
      // Mock Data URL de imagen de boceto UML
      _imageBase64 = 'sample_sketch';
      _hintCtrl.text = 'E-Commerce con Pedido y Clientes';
    });
  }

  Future<void> _processVisionAi() async {
    if (_imageBase64 == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFFEF4444),
          content: Text('Por favor toma una foto o selecciona una imagen de la galería primero.'),
        ),
      );
      return;
    }

    setState(() => _isAnalyzing = true);

    try {
      final provider = context.read<ProjectProvider>();
      final classes = await UmlVisionAiService.analyzeDiagramImage(
        imageSource: _imageBase64!,
        optionalContextHint: _hintCtrl.text,
      );

      final relations = UmlVisionAiService.generateInferredRelations(classes);

      for (final c in classes) {
        provider.addClassManual(c);
      }
      for (final r in relations) {
        provider.addRelation(r);
      }

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Text(
              '✨ ¡Digitalización completada! ${classes.length} clases y ${relations.length} relaciones organizadas en el lienzo sin superposición.',
            ),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isAnalyzing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFFEF4444),
            content: Text('Error al analizar la imagen: $e'),
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _hintCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Barra superior de arrastre
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFF334155),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Título
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFA855F7).withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.document_scanner, color: Color(0xFFA855F7), size: 24),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Escanear Boceto UML con IA',
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        'Foto o galería digitalizada y organizada en grilla 2D',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Opciones de Entrada de Foto
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _isAnalyzing ? null : _pickFromCamera,
                    icon: const Icon(Icons.camera_alt, color: Color(0xFF38BDF8), size: 18),
                    label: const Text('Tomar Foto', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 12)),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF38BDF8)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _isAnalyzing ? null : _pickFromGallery,
                    icon: const Icon(Icons.photo_library, color: Color(0xFF2DD4BF), size: 18),
                    label: const Text('Galería', style: TextStyle(color: Color(0xFF2DD4BF), fontSize: 12)),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF2DD4BF)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _isAnalyzing ? null : _loadSampleSketch,
                    icon: const Icon(Icons.draw, color: Color(0xFFF59E0B), size: 18),
                    label: const Text('Muestra', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 12)),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFFF59E0B)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Visor / Vista Previa de la Imagen
            Container(
              height: 170,
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: _imageBase64 != null ? const Color(0xFFA855F7) : const Color(0xFF334155),
                  width: 1.5,
                ),
              ),
              child: _imageBase64 != null
                  ? _buildImagePreview()
                  : const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_a_photo_outlined, size: 40, color: Color(0xFF64748B)),
                        SizedBox(height: 8),
                        Text(
                          'Saca una foto a tu pizarra o papel con el diagrama UML',
                          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                          textAlign: TextAlign.center,
                        ),
                        SizedBox(height: 4),
                        Text(
                          'La IA lo transcribirá a clases reales automáticamente',
                          style: TextStyle(color: Color(0xFF64748B), fontSize: 11),
                        ),
                      ],
                    ),
            ),
            const SizedBox(height: 14),

            // Campo de Pista / Contexto Opcional
            TextField(
              controller: _hintCtrl,
              enabled: !_isAnalyzing,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.psychology_outlined, color: Color(0xFFA855F7), size: 18),
                labelText: 'Dominio o contexto (opcional)',
                labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                hintText: 'Ej. E-Commerce, Hospital, Hotel, Universidad...',
                hintStyle: const TextStyle(color: Color(0xFF475569), fontSize: 12),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              ),
            ),
            const SizedBox(height: 18),

            // Botón de Procesar con IA
            ElevatedButton(
              onPressed: _isAnalyzing || _imageBase64 == null ? null : _processVisionAi,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF7C3AED),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isAnalyzing
                  ? const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        ),
                        SizedBox(width: 12),
                        Text(
                          'Digitalizando y organizando en grilla 2D...',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                      ],
                    )
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.auto_awesome, size: 18, color: Colors.amber),
                        SizedBox(width: 8),
                        Text(
                          'Digitalizar Diagrama con IA',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImagePreview() {
    if (_imageBase64 == 'sample_sketch') {
      return Stack(
        alignment: Alignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF182234),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildMockSketchBox('Cliente', ['+id: Long', '+nombre: String']),
                const Icon(Icons.arrow_forward, color: Colors.white38),
                _buildMockSketchBox('Pedido', ['+id: Long', '+fecha: Date']),
                const Icon(Icons.arrow_forward, color: Colors.white38),
                _buildMockSketchBox('Producto', ['+id: Long', '+precio: Double']),
              ],
            ),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text('Boceto Cargado', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      );
    }

    if (_imageBase64!.startsWith('data:image')) {
      try {
        final commaIdx = _imageBase64!.indexOf(',');
        final base64Data = commaIdx != -1 ? _imageBase64!.substring(commaIdx + 1) : _imageBase64!;
        final bytes = base64Decode(base64Data);
        return ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.memory(bytes, fit: BoxFit.contain, width: double.infinity),
        );
      } catch (_) {}
    }

    return const Center(
      child: Icon(Icons.check_circle, color: Color(0xFF10B981), size: 48),
    );
  }

  Widget _buildMockSketchBox(String name, List<String> attrs) {
    return Container(
      width: 85,
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        border: Border.all(color: const Color(0xFF64748B)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(name, style: const TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.bold)),
          const Divider(color: Color(0xFF334155), height: 8),
          ...attrs.map((a) => Text(a, style: const TextStyle(color: Colors.white70, fontSize: 8))),
        ],
      ),
    );
  }
}
