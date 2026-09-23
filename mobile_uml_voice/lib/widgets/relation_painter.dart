import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../models/uml_models.dart';

class RelationPainter extends CustomPainter {
  final List<UmlClass> classes;
  final List<UmlRelation> relations;

  RelationPainter({required this.classes, required this.relations});

  @override
  void paint(Canvas canvas, Size size) {
    final classMap = {for (var c in classes) c.id: c};

    final linePaint = Paint()
      ..color = const Color(0xFF64748B)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;

    const classWidth = 210.0;
    const classHeight = 130.0;

    for (final rel in relations) {
      final src = classMap[rel.sourceClassId];
      final tgt = classMap[rel.targetClassId];
      if (src == null || tgt == null) continue;

      final p1 = Offset(src.position.dx + classWidth / 2, src.position.dy + classHeight / 2);
      final p2 = Offset(tgt.position.dx + classWidth / 2, tgt.position.dy + classHeight / 2);

      // Dibujar línea principal
      if (rel.type == UmlRelationType.dependency) {
        _drawDashedLine(canvas, p1, p2, linePaint);
      } else {
        canvas.drawLine(p1, p2, linePaint);
      }

      // Dibujar conectores según tipo UML
      switch (rel.type) {
        case UmlRelationType.composition:
          _drawDiamond(canvas, p1, p2, isFilled: true);
          _drawArrow(canvas, p1, p2);
          break;
        case UmlRelationType.aggregation:
          _drawDiamond(canvas, p1, p2, isFilled: false);
          _drawArrow(canvas, p1, p2);
          break;
        case UmlRelationType.inheritance:
          _drawTriangle(canvas, p1, p2);
          break;
        case UmlRelationType.dependency:
        case UmlRelationType.association:
        default:
          _drawArrow(canvas, p1, p2);
          break;
      }

      // Etiqueta central (Verbo / Nombre)
      final mid = Offset((p1.dx + p2.dx) / 2, (p1.dy + p2.dy) / 2);
      final labelText = rel.name.isNotEmpty ? rel.name : rel.type.label;
      _drawLabel(canvas, mid, labelText, isStereotype: rel.name.isEmpty);

      // Multiplicidad en Origen
      if (rel.sourceMultiplicity.isNotEmpty) {
        final posSrc = _offsetAlong(p1, p2, 45.0, 14.0);
        _drawMultiplicity(canvas, posSrc, rel.sourceMultiplicity);
      }

      // Multiplicidad en Destino
      if (rel.targetMultiplicity.isNotEmpty) {
        final posTgt = _offsetAlong(p2, p1, 45.0, 14.0);
        _drawMultiplicity(canvas, posTgt, rel.targetMultiplicity);
      }
    }
  }

  Offset _offsetAlong(Offset from, Offset to, double distanceAlong, double normalDistance) {
    final angle = math.atan2(to.dy - from.dy, to.dx - from.dx);
    final normAngle = angle + math.pi / 2;
    return Offset(
      from.dx + distanceAlong * math.cos(angle) + normalDistance * math.cos(normAngle),
      from.dy + distanceAlong * math.sin(angle) + normalDistance * math.sin(normAngle),
    );
  }

  void _drawDashedLine(Canvas canvas, Offset p1, Offset p2, Paint paint) {
    const dashWidth = 6.0;
    const dashSpace = 4.0;
    final dx = p2.dx - p1.dx;
    final dy = p2.dy - p1.dy;
    final totalDist = math.sqrt(dx * dx + dy * dy);
    final angle = math.atan2(dy, dx);

    double currentDist = 0;
    while (currentDist < totalDist) {
      final start = Offset(p1.dx + currentDist * math.cos(angle), p1.dy + currentDist * math.sin(angle));
      final nextDist = math.min(currentDist + dashWidth, totalDist);
      final end = Offset(p1.dx + nextDist * math.cos(angle), p1.dy + nextDist * math.sin(angle));
      canvas.drawLine(start, end, paint);
      currentDist += dashWidth + dashSpace;
    }
  }

  void _drawDiamond(Canvas canvas, Offset p1, Offset p2, {required bool isFilled}) {
    final angle = math.atan2(p2.dy - p1.dy, p2.dx - p1.dx);
    const dSize = 10.0;

    final path = Path();
    path.moveTo(p1.dx + dSize * math.cos(angle), p1.dy + dSize * math.sin(angle));
    path.lineTo(p1.dx + dSize * math.cos(angle + math.pi / 2), p1.dy + dSize * math.sin(angle + math.pi / 2));
    path.lineTo(p1.dx - dSize * math.cos(angle), p1.dy - dSize * math.sin(angle));
    path.lineTo(p1.dx + dSize * math.cos(angle - math.pi / 2), p1.dy + dSize * math.sin(angle - math.pi / 2));
    path.close();

    final paint = Paint()
      ..color = isFilled ? const Color(0xFF38BDF8) : const Color(0xFF0F172A)
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, paint);

    final borderPaint = Paint()
      ..color = const Color(0xFF38BDF8)
      ..strokeWidth = 1.8
      ..style = PaintingStyle.stroke;
    canvas.drawPath(path, borderPaint);
  }

  void _drawTriangle(Canvas canvas, Offset p1, Offset p2) {
    final angle = math.atan2(p2.dy - p1.dy, p2.dx - p1.dx);
    const triLen = 14.0;
    const triWidth = 9.0;

    final path = Path();
    path.moveTo(p2.dx, p2.dy);
    path.lineTo(
      p2.dx - triLen * math.cos(angle) + triWidth * math.cos(angle + math.pi / 2),
      p2.dy - triLen * math.sin(angle) + triWidth * math.sin(angle + math.pi / 2),
    );
    path.lineTo(
      p2.dx - triLen * math.cos(angle) + triWidth * math.cos(angle - math.pi / 2),
      p2.dy - triLen * math.sin(angle) + triWidth * math.sin(angle - math.pi / 2),
    );
    path.close();

    final fillPaint = Paint()
      ..color = const Color(0xFF0F172A)
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, fillPaint);

    final borderPaint = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 1.8
      ..style = PaintingStyle.stroke;
    canvas.drawPath(path, borderPaint);
  }

  void _drawArrow(Canvas canvas, Offset p1, Offset p2) {
    final angle = math.atan2(p2.dy - p1.dy, p2.dx - p1.dx);
    const arrowLen = 12.0;
    const arrowAngle = math.pi / 6;

    final paint = Paint()
      ..color = const Color(0xFF94A3B8)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;

    final path = Path();
    path.moveTo(p2.dx, p2.dy);
    path.lineTo(
      p2.dx - arrowLen * math.cos(angle - arrowAngle),
      p2.dy - arrowLen * math.sin(angle - arrowAngle),
    );
    path.moveTo(p2.dx, p2.dy);
    path.lineTo(
      p2.dx - arrowLen * math.cos(angle + arrowAngle),
      p2.dy - arrowLen * math.sin(angle + arrowAngle),
    );

    canvas.drawPath(path, paint);
  }

  void _drawLabel(Canvas canvas, Offset pos, String text, {bool isStereotype = false}) {
    final span = TextSpan(
      text: isStereotype ? '«$text»' : text,
      style: TextStyle(
        color: isStereotype ? const Color(0xFF94A3B8) : const Color(0xFFE2E8F0),
        fontSize: 10,
        fontStyle: isStereotype ? FontStyle.italic : FontStyle.normal,
        fontWeight: FontWeight.w600,
      ),
    );
    final tp = TextPainter(text: span, textAlign: TextAlign.center, textDirection: TextDirection.ltr)..layout();

    final bgRect = Rect.fromCenter(center: pos, width: tp.width + 12, height: tp.height + 6);
    final bgPaint = Paint()..color = const Color(0xFF0F172A);
    final borderPaint = Paint()
      ..color = const Color(0xFF334155)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    canvas.drawRRect(RRect.fromRectAndRadius(bgRect, const Radius.circular(5)), bgPaint);
    canvas.drawRRect(RRect.fromRectAndRadius(bgRect, const Radius.circular(5)), borderPaint);
    tp.paint(canvas, Offset(pos.dx - tp.width / 2, pos.dy - tp.height / 2));
  }

  void _drawMultiplicity(Canvas canvas, Offset pos, String text) {
    final span = TextSpan(
      text: text,
      style: const TextStyle(
        color: Color(0xFF2DD4BF),
        fontSize: 10,
        fontWeight: FontWeight.bold,
      ),
    );
    final tp = TextPainter(text: span, textAlign: TextAlign.center, textDirection: TextDirection.ltr)..layout();
    tp.paint(canvas, Offset(pos.dx - tp.width / 2, pos.dy - tp.height / 2));
  }

  @override
  bool shouldRepaint(covariant RelationPainter oldDelegate) => true;
}
