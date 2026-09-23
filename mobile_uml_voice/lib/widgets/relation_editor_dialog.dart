import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/uml_models.dart';

class RelationEditorDialog extends StatefulWidget {
  final List<UmlClass> classes;
  final UmlRelation? existingRelation;
  final String? initialSourceId;
  final String? initialTargetId;
  final Function(UmlRelation relation) onSave;

  const RelationEditorDialog({
    Key? key,
    required this.classes,
    this.existingRelation,
    this.initialSourceId,
    this.initialTargetId,
    required this.onSave,
  }) : super(key: key);

  @override
  State<RelationEditorDialog> createState() => _RelationEditorDialogState();
}

class _RelationEditorDialogState extends State<RelationEditorDialog> {
  late String _sourceClassId;
  late String _targetClassId;
  late UmlRelationType _type;
  late TextEditingController _nameCtrl;
  late String _sourceMultiplicity;
  late String _targetMultiplicity;
  final _uuid = const Uuid();

  static const List<String> multiplicityOptions = ['1..1', '0..1', '1..*', '0..*'];

  @override
  void initState() {
    super.initState();
    if (widget.existingRelation != null) {
      _sourceClassId = widget.existingRelation!.sourceClassId;
      _targetClassId = widget.existingRelation!.targetClassId;
      _type = widget.existingRelation!.type;
      _nameCtrl = TextEditingController(text: widget.existingRelation!.name);
      _sourceMultiplicity = widget.existingRelation!.sourceMultiplicity;
      _targetMultiplicity = widget.existingRelation!.targetMultiplicity;
    } else {
      _sourceClassId = widget.initialSourceId ?? (widget.classes.isNotEmpty ? widget.classes.first.id : '');
      _targetClassId = widget.initialTargetId ?? (widget.classes.length > 1 ? widget.classes[1].id : (widget.classes.isNotEmpty ? widget.classes.first.id : ''));
      _type = UmlRelationType.association;
      _nameCtrl = TextEditingController(text: 'asocia');
      _sourceMultiplicity = '1..1';
      _targetMultiplicity = '0..*';
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  void _save() {
    if (_sourceClassId == _targetClassId) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('La clase de origen y destino no pueden ser la misma para esta relación.')),
      );
      return;
    }

    final rel = UmlRelation(
      id: widget.existingRelation?.id ?? 'rel_${_uuid.v4().substring(0, 8)}',
      sourceClassId: _sourceClassId,
      targetClassId: _targetClassId,
      type: _type,
      name: _nameCtrl.text.trim(),
      sourceMultiplicity: _sourceMultiplicity,
      targetMultiplicity: _targetMultiplicity,
    );

    widget.onSave(rel);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          const Icon(Icons.hub, color: Color(0xFF38BDF8), size: 20),
          const SizedBox(width: 8),
          Text(
            widget.existingRelation != null ? 'Editar Relación UML' : 'Nueva Conexión UML',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: SizedBox(
          width: 380,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Clase Origen
              const Text('Clase Origen (Fuente)', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _sourceClassId.isNotEmpty ? _sourceClassId : null,
                    dropdownColor: const Color(0xFF0F172A),
                    isExpanded: true,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    items: widget.classes.map((c) {
                      return DropdownMenuItem(value: c.id, child: Text(c.name));
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _sourceClassId = val);
                    },
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // Tipo de Relación
              const Text('Tipo de Conector UML', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<UmlRelationType>(
                    value: _type,
                    dropdownColor: const Color(0xFF0F172A),
                    isExpanded: true,
                    style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 13),
                    items: UmlRelationType.values.map((t) {
                      return DropdownMenuItem(value: t, child: Text('${t.label} (${t.code})'));
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _type = val);
                    },
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // Clase Destino
              const Text('Clase Destino', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _targetClassId.isNotEmpty ? _targetClassId : null,
                    dropdownColor: const Color(0xFF0F172A),
                    isExpanded: true,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    items: widget.classes.map((c) {
                      return DropdownMenuItem(value: c.id, child: Text(c.name));
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _targetClassId = val);
                    },
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // Multiplicidades
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Mult. Origen', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFF334155)),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _sourceMultiplicity,
                              dropdownColor: const Color(0xFF0F172A),
                              isExpanded: true,
                              style: const TextStyle(color: Color(0xFF2DD4BF), fontSize: 12),
                              items: multiplicityOptions.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                              onChanged: (v) {
                                if (v != null) setState(() => _sourceMultiplicity = v);
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Mult. Destino', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFF334155)),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _targetMultiplicity,
                              dropdownColor: const Color(0xFF0F172A),
                              isExpanded: true,
                              style: const TextStyle(color: Color(0xFF2DD4BF), fontSize: 12),
                              items: multiplicityOptions.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                              onChanged: (v) {
                                if (v != null) setState(() => _targetMultiplicity = v);
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // Etiqueta del conector (Verbo)
              const Text('Etiqueta / Verbo de Relación', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              const SizedBox(height: 4),
              TextField(
                controller: _nameCtrl,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'ej. contiene, registra, asocia',
                  hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                  filled: true,
                  fillColor: const Color(0xFF0F172A),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF334155))),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar', style: TextStyle(color: Color(0xFF94A3B8))),
        ),
        ElevatedButton(
          onPressed: _save,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
          child: const Text('Establecer Conexión', style: TextStyle(color: Colors.white)),
        ),
      ],
    );
  }
}
