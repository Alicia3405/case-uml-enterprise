import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/uml_models.dart';

class ClassEditorSheet extends StatefulWidget {
  final UmlClass umlClass;
  final Function(UmlClass updatedClass) onSave;
  final VoidCallback onDelete;

  const ClassEditorSheet({
    Key? key,
    required this.umlClass,
    required this.onSave,
    required this.onDelete,
  }) : super(key: key);

  @override
  State<ClassEditorSheet> createState() => _ClassEditorSheetState();
}

class _ClassEditorSheetState extends State<ClassEditorSheet> with SingleTickerProviderStateMixin {
  late TextEditingController _nameCtrl;
  late String _stereotype;
  late List<UmlAttribute> _attributes;
  late List<UmlMethod> _methods;
  late TabController _tabController;
  final _uuid = const Uuid();

  static const List<String> availableStereotypes = [
    '«entity»',
    '«service»',
    '«controller»',
    '«repository»',
    '«interface»',
    '«dto»',
  ];

  static const List<String> availableTypes = [
    'String',
    'Long',
    'Integer',
    'Double',
    'Boolean',
    'LocalDate',
  ];

  static const List<String> availableReturnTypes = [
    'void',
    'String',
    'Long',
    'Integer',
    'Boolean',
    'List',
  ];

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.umlClass.name);
    _stereotype = widget.umlClass.stereotype;
    // Copias profundas para poder cancelar o guardar
    _attributes = widget.umlClass.attributes.map((a) => UmlAttribute(
      id: a.id,
      name: a.name,
      type: a.type,
      visibility: a.visibility,
      isPrimaryKey: a.isPrimaryKey,
      isNullable: a.isNullable,
    )).toList();

    _methods = widget.umlClass.methods.map((m) => UmlMethod(
      id: m.id,
      name: m.name,
      returnType: m.returnType,
      visibility: m.visibility,
      parameters: m.parameters.map((p) => UmlMethodParam(name: p.name, type: p.type)).toList(),
    )).toList();

    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _tabController.dispose();
    super.dispose();
  }

  void _addNewAttribute() {
    setState(() {
      _attributes.add(UmlAttribute(
        id: 'a_${_uuid.v4().substring(0, 6)}',
        name: 'nuevoCampo',
        type: 'String',
        visibility: UmlVisibility.public,
      ));
    });
  }

  void _addNewMethod() {
    setState(() {
      _methods.add(UmlMethod(
        id: 'm_${_uuid.v4().substring(0, 6)}',
        name: 'nuevaOperacion',
        returnType: 'void',
        visibility: UmlVisibility.public,
      ));
    });
  }

  void _save() {
    final updated = UmlClass(
      id: widget.umlClass.id,
      name: _nameCtrl.text.trim().isEmpty ? widget.umlClass.name : _nameCtrl.text.trim(),
      stereotype: _stereotype,
      position: widget.umlClass.position,
      attributes: _attributes,
      methods: _methods,
    );
    widget.onSave(updated);
    Navigator.pop(context);
  }

  void _confirmDelete() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('¿Eliminar Clase?', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: Text(
          'Se eliminará "${widget.umlClass.name}" y todas las conexiones vinculadas a ella en el lienzo.',
          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pop(context);
              widget.onDelete();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            child: const Text('Eliminar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Barra de agarre
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFF334155),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Título y botón eliminar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.tune, color: Color(0xFF38BDF8), size: 22),
                const SizedBox(width: 8),
                const Text(
                  'Inspector de Clase UML',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const Spacer(),
                IconButton(
                  onPressed: _confirmDelete,
                  icon: const Icon(Icons.delete_outline, color: Color(0xFFEF4444)),
                  tooltip: 'Eliminar Clase',
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),

          // Campos Principales: Nombre y Estereotipo
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
            child: Row(
              children: [
                // Nombre
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: _nameCtrl,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                    decoration: InputDecoration(
                      labelText: 'Nombre de la Clase',
                      labelStyle: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.w600),
                      filled: true,
                      fillColor: const Color(0xFF1E293B),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFF334155)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFF334155)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFF7C3AED), width: 1.5),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                // Estereotipo
                Expanded(
                  flex: 2,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF334155)),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: availableStereotypes.contains(_stereotype) ? _stereotype : '«entity»',
                        dropdownColor: const Color(0xFF1E293B),
                        style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.bold),
                        items: availableStereotypes.map((st) {
                          return DropdownMenuItem(value: st, child: Text(st));
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _stereotype = val);
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 10),

          // Tabs: Atributos y Métodos
          TabBar(
            controller: _tabController,
            indicatorColor: const Color(0xFF7C3AED),
            labelColor: const Color(0xFF38BDF8),
            unselectedLabelColor: const Color(0xFF64748B),
            tabs: [
              Tab(text: 'Atributos (${_attributes.length})'),
              Tab(text: 'Métodos (${_methods.length})'),
            ],
          ),

          // Contenido de Tabs
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // TAB 1: ATRIBUTOS
                _buildAttributesTab(),
                // TAB 2: MÉTODOS
                _buildMethodsTab(),
              ],
            ),
          ),

          // Botón Guardar con texto blanco nítido
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton.icon(
              onPressed: _save,
              icon: const Icon(Icons.check_circle_outline, size: 20, color: Colors.white),
              label: const Text(
                'Aplicar Cambios a la Clase',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF7C3AED),
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAttributesTab() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('CAMPOS & PROPIEDADES', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
              TextButton.icon(
                onPressed: _addNewAttribute,
                icon: const Icon(Icons.add, size: 16, color: Color(0xFF2DD4BF)),
                label: const Text('Nuevo Atributo', style: TextStyle(fontSize: 12, color: Color(0xFF2DD4BF))),
              ),
            ],
          ),
        ),
        Expanded(
          child: _attributes.isEmpty
              ? const Center(
                  child: Text('Sin atributos. Pulsa "+ Nuevo Atributo"', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _attributes.length,
                  itemBuilder: (ctx, idx) {
                    final attr = _attributes[idx];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: attr.isPrimaryKey ? const Color(0xFFF59E0B).withOpacity(0.5) : const Color(0xFF334155),
                        ),
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              // Visibilidad (+, -, #)
                              DropdownButtonHideUnderline(
                                child: DropdownButton<UmlVisibility>(
                                  value: attr.visibility,
                                  dropdownColor: const Color(0xFF1E293B),
                                  style: const TextStyle(color: Color(0xFF2DD4BF), fontWeight: FontWeight.bold),
                                  items: UmlVisibility.values.map((v) {
                                    return DropdownMenuItem(value: v, child: Text(v.symbol));
                                  }).toList(),
                                  onChanged: (val) {
                                    if (val != null) setState(() => attr.visibility = val);
                                  },
                                ),
                              ),
                              const SizedBox(width: 8),
                              // Nombre del campo
                              Expanded(
                                flex: 3,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF0F172A),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: const Color(0xFF334155)),
                                  ),
                                  child: TextFormField(
                                    initialValue: attr.name,
                                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                                    decoration: const InputDecoration(
                                      isDense: true,
                                      hintText: 'nombreCampo',
                                      hintStyle: TextStyle(color: Color(0xFF64748B)),
                                      border: InputBorder.none,
                                    ),
                                    onChanged: (val) => attr.name = val,
                                  ),
                                ),
                              ),
                              // Tipo
                              Expanded(
                                flex: 2,
                                child: DropdownButtonHideUnderline(
                                  child: DropdownButton<String>(
                                    value: availableTypes.contains(attr.type) ? attr.type : 'String',
                                    dropdownColor: const Color(0xFF1E293B),
                                    style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12),
                                    items: availableTypes.map((t) {
                                      return DropdownMenuItem(value: t, child: Text(t));
                                    }).toList(),
                                    onChanged: (val) {
                                      if (val != null) setState(() => attr.type = val);
                                    },
                                  ),
                                ),
                              ),
                              // Botón eliminar atributo
                              IconButton(
                                icon: const Icon(Icons.close, size: 16, color: Color(0xFF94A3B8)),
                                onPressed: () {
                                  setState(() => _attributes.removeAt(idx));
                                },
                              ),
                            ],
                          ),
                          Row(
                            children: [
                              // Primary Key Checkbox
                              InkWell(
                                onTap: () => setState(() => attr.isPrimaryKey = !attr.isPrimaryKey),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      attr.isPrimaryKey ? Icons.check_box : Icons.check_box_outline_blank,
                                      size: 16,
                                      color: attr.isPrimaryKey ? const Color(0xFFF59E0B) : const Color(0xFF64748B),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Primary Key [PK]',
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: attr.isPrimaryKey ? const Color(0xFFFCD34D) : const Color(0xFF94A3B8),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 16),
                              // Nullable Checkbox
                              InkWell(
                                onTap: () => setState(() => attr.isNullable = !attr.isNullable),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      attr.isNullable ? Icons.check_box : Icons.check_box_outline_blank,
                                      size: 16,
                                      color: const Color(0xFF38BDF8),
                                    ),
                                    const SizedBox(width: 4),
                                    const Text('Permite Null', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildMethodsTab() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('MÉTODOS & OPERACIONES', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
              TextButton.icon(
                onPressed: _addNewMethod,
                icon: const Icon(Icons.add, size: 16, color: Color(0xFF2DD4BF)),
                label: const Text('Nuevo Método', style: TextStyle(fontSize: 12, color: Color(0xFF2DD4BF))),
              ),
            ],
          ),
        ),
        Expanded(
          child: _methods.isEmpty
              ? const Center(
                  child: Text('Sin métodos. Pulsa "+ Nuevo Método"', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _methods.length,
                  itemBuilder: (ctx, idx) {
                    final meth = _methods[idx];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF334155)),
                      ),
                      child: Row(
                        children: [
                          DropdownButtonHideUnderline(
                            child: DropdownButton<UmlVisibility>(
                              value: meth.visibility,
                              dropdownColor: const Color(0xFF1E293B),
                              style: const TextStyle(color: Color(0xFF2DD4BF), fontWeight: FontWeight.bold),
                              items: UmlVisibility.values.map((v) {
                                return DropdownMenuItem(value: v, child: Text(v.symbol));
                              }).toList(),
                              onChanged: (val) {
                                if (val != null) setState(() => meth.visibility = val);
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Nombre del método
                          Expanded(
                            flex: 3,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0F172A),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFF334155)),
                              ),
                              child: TextFormField(
                                initialValue: meth.name,
                                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                                decoration: const InputDecoration(
                                  isDense: true,
                                  hintText: 'nombreMetodo',
                                  hintStyle: TextStyle(color: Color(0xFF64748B)),
                                  border: InputBorder.none,
                                ),
                                onChanged: (val) => meth.name = val,
                              ),
                            ),
                          ),
                          // Retorno
                          Expanded(
                            flex: 2,
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                value: availableReturnTypes.contains(meth.returnType) ? meth.returnType : 'void',
                                dropdownColor: const Color(0xFF1E293B),
                                style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12),
                                items: availableReturnTypes.map((t) {
                                  return DropdownMenuItem(value: t, child: Text(t));
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) setState(() => meth.returnType = val);
                                },
                              ),
                            ),
                          ),
                          // Botón eliminar
                          IconButton(
                            icon: const Icon(Icons.close, size: 16, color: Color(0xFF94A3B8)),
                            onPressed: () {
                              setState(() => _methods.removeAt(idx));
                            },
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
