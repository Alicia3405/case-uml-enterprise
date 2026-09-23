import 'package:flutter/material.dart';
import '../models/uml_models.dart';

class UmlClassBox extends StatelessWidget {
  final UmlClass umlClass;
  final bool isSelected;
  final String? lockedByUserName;
  final Color? lockedByUserColor;
  final VoidCallback onTap;
  final Function(Offset newPos) onDragEnd;

  const UmlClassBox({
    Key? key,
    required this.umlClass,
    this.isSelected = false,
    this.lockedByUserName,
    this.lockedByUserColor,
    required this.onTap,
    required this.onDragEnd,
  }) : super(key: key);

  bool get isLocked => lockedByUserName != null && lockedByUserName!.isNotEmpty;

  void _handleTap(BuildContext context) {
    if (isLocked) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFFF59E0B),
          duration: const Duration(seconds: 3),
          content: Row(
            children: [
              const Icon(Icons.lock, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '🔒 Tabla bloqueada: "$lockedByUserName" la está editando en este momento.',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
            ],
          ),
        ),
      );
      return;
    }
    onTap();
  }

  @override
  Widget build(BuildContext context) {
    final lockColor = lockedByUserColor ?? const Color(0xFFF59E0B);

    return Positioned(
      left: umlClass.position.dx,
      top: umlClass.position.dy,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          GestureDetector(
            onTap: () => _handleTap(context),
            onDoubleTap: () => _handleTap(context),
            onPanUpdate: isLocked
                ? null
                : (details) {
                    onDragEnd(umlClass.position + details.delta);
                  },
            child: Container(
              width: 210,
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isLocked
                      ? lockColor
                      : isSelected
                          ? const Color(0xFFA855F7)
                          : const Color(0xFF334155),
                  width: isLocked ? 2.5 : (isSelected ? 2.2 : 1.2),
                ),
                boxShadow: [
                  BoxShadow(
                    color: isLocked
                        ? lockColor.withOpacity(0.45)
                        : isSelected
                            ? const Color(0xFFA855F7).withOpacity(0.3)
                            : Colors.black.withOpacity(0.4),
                    blurRadius: isLocked ? 18 : (isSelected ? 16 : 8),
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Cabecera con botón de edición rápida o candado
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                    decoration: BoxDecoration(
                      color: isLocked ? lockColor.withOpacity(0.18) : const Color(0xFF1E293B),
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
                    ),
                    child: Row(
                      children: [
                        if (isLocked)
                          const Padding(
                            padding: EdgeInsets.only(right: 6),
                            child: Icon(Icons.lock, size: 16, color: Color(0xFFF59E0B)),
                          )
                        else
                          const SizedBox(width: 20),
                        Expanded(
                          child: Column(
                            children: [
                              Text(
                                umlClass.stereotype,
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontStyle: FontStyle.italic,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                umlClass.name,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: isLocked ? lockColor : Colors.white,
                                ),
                                textAlign: TextAlign.center,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          icon: Icon(
                            isLocked ? Icons.lock_outline : Icons.edit_note,
                            size: 20,
                            color: isLocked ? lockColor : const Color(0xFF38BDF8),
                          ),
                          tooltip: isLocked ? 'En edición por $lockedByUserName' : 'Editar Clase y Atributos',
                          onPressed: () => _handleTap(context),
                        ),
                      ],
                    ),
                  ),

                  // Compartimento de Atributos
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
                    decoration: const BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: Color(0xFF334155), width: 1),
                      ),
                    ),
                    child: umlClass.attributes.isEmpty
                        ? const Text(
                            '(sin atributos)',
                            style: TextStyle(fontSize: 10, color: Color(0xFF64748B), fontStyle: FontStyle.italic),
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: umlClass.attributes.map((attr) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 1.5),
                                child: Row(
                                  children: [
                                    Text(
                                      attr.visibility.symbol,
                                      style: const TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF2DD4BF),
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: RichText(
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        text: TextSpan(
                                          text: attr.name,
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: attr.isPrimaryKey ? FontWeight.bold : FontWeight.normal,
                                            color: attr.isPrimaryKey ? const Color(0xFFFCD34D) : const Color(0xFFE2E8F0),
                                          ),
                                          children: [
                                            TextSpan(
                                              text: ': ${attr.type}',
                                              style: const TextStyle(
                                                color: Color(0xFF38BDF8),
                                                fontWeight: FontWeight.normal,
                                              ),
                                            ),
                                            if (attr.isPrimaryKey)
                                              const TextSpan(
                                                text: ' [PK]',
                                                style: TextStyle(
                                                  color: Color(0xFFF59E0B),
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                  ),

                  // Compartimento de Métodos
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
                    child: umlClass.methods.isEmpty
                        ? const Text(
                            '(sin métodos)',
                            style: TextStyle(fontSize: 10, color: Color(0xFF64748B), fontStyle: FontStyle.italic),
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: umlClass.methods.map((method) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 1.5),
                                child: Row(
                                  children: [
                                    const Text(
                                      '+',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF2DD4BF),
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        '${method.name}(): ${method.returnType}',
                                        style: const TextStyle(
                                          fontSize: 10,
                                          color: Color(0xFFCBD5E1),
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                  ),
                ],
              ),
            ),
          ),

          // Insignia Flotante de Bloqueo Colaborativo
          if (isLocked)
            Positioned(
              top: -12,
              left: 14,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: lockColor,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.5),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.lock, size: 11, color: Colors.white),
                    const SizedBox(width: 4),
                    Text(
                      'En edición: $lockedByUserName',
                      style: const TextStyle(
                        fontSize: 10,
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
